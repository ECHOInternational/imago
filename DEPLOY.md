# Deploying imago (Lambda@Edge image resizer)

Two **Lambda@Edge** functions in **us-east-1** behind CloudFront. **No planned downtime** —
CloudFront association swaps are rolling (each edge serves the old version until it picks up
the new one).

## Live wiring (two distributions)

| Distribution | Alias | Event | Function |
|---|---|---|---|
| `ENB35KB6OG9M0` | images.echocommunity.org | viewer-request | ViewerRequest |
| `ENB35KB6OG9M0` | images.echocommunity.org | origin-response | OriginResponse (Sharp resizer) |
| `EHYBSK32BOWDP` | cdn1.echocommunity.org | origin-request | ViewerRequest (same fn, different distro) |

> ⚠️ **Direct-API deploy model, NOT `cloudformation deploy`.** The stack
> `ECHOCommunity-Images-US-East-1` is drifted (its template pins versions/associations to `:1`;
> production runs later versions set out-of-band, and `cdn1` is external to the stack). Deploying
> the template would reset associations and regress production. `cloud-formation-template.yml`'s
> runtimes are kept current (nodejs22.x) for accuracy only.

## Functions

- **ViewerRequest** (`lambda/viewer-request-function/`): pure JS URL rewriter. No build needed.
- **OriginResponse** (`lambda/origin-response-function/`): reads the original from S3, resizes
  with **Sharp**, writes back, returns the image. Uses **`@aws-sdk/client-s3`** (SDK v3) — note
  v3 `GetObject` returns the body as a stream (`transformToByteArray()` before `Sharp()`).
  S3 access is granted by the **bucket policy** (the EdgeLambdaRole has `s3:GetObject`+`PutObject`);
  no IAM change needed.

## Prerequisites
AWS creds with `lambda:*` + `cloudfront:GetDistributionConfig`/`UpdateDistribution`; **Docker**
(Sharp's native binary must be built for the Lambda runtime = linux/x64).

## 1. Build the OriginResponse package (linux-x64)
```bash
cd lambda/origin-response-function
docker run --rm --platform linux/amd64 -v "$PWD":/app -w /app node:22 \
  npm ci --omit=dev --no-audit --no-fund        # installs @img/sharp-linux-x64
( zip -qr /tmp/origin-response.zip index.js node_modules package.json )
ls -la /tmp/origin-response.zip   # MUST be < 50 MB (Lambda@Edge origin-event limit; ~10 MB expected)
```

## 2. Update functions + publish versions
> ⚠️ **Runtime BEFORE code.** AWS blocks `update-function-code` while the function is still on a
> deprecated runtime (e.g. nodejs12.x). Bump the runtime first, then upload code.
```bash
R="--region us-east-1"
VR=ECHOCommunity-Images-US-East-ViewerRequestFunction-1FJYZI57PXWZY
OR=ECHOCommunity-Images-US-Eas-OriginResponseFunction-FYH56QZWLF05

# ViewerRequest — runtime bump only (code already current in this repo)
aws lambda update-function-configuration $R --function-name $VR --runtime nodejs22.x
aws lambda wait function-updated $R --function-name $VR
VR_NEW=$(aws lambda publish-version $R --function-name $VR --query Version --output text)

# OriginResponse — runtime first, THEN code
aws lambda update-function-configuration $R --function-name $OR --runtime nodejs22.x
aws lambda wait function-updated $R --function-name $OR
aws lambda update-function-code $R --function-name $OR --zip-file fileb:///tmp/origin-response.zip
aws lambda wait function-updated $R --function-name $OR
OR_NEW=$(aws lambda publish-version $R --function-name $OR --query Version --output text)
echo "VR_NEW=$VR_NEW OR_NEW=$OR_NEW"
```

## 3. Pre-validate the new versions (direct invoke — nothing live yet)
Find a real original key (`<uuid>/<name>.ext`) in `images-us-east-1.echocommunity.org`, then:
```bash
# ViewerRequest -> expect a rewritten request.uri (compare to current images version, should match)
printf '{"Records":[{"cf":{"request":{"uri":"/<uuid>/<name>.jpg","querystring":"w=600","headers":{"accept":[{"key":"Accept","value":"image/webp"}]}}}}]}' > /tmp/vr.json
aws lambda invoke $R --function-name "$VR:$VR_NEW" --cli-binary-format raw-in-base64-out --payload file:///tmp/vr.json /tmp/vro.json --query FunctionError

# OriginResponse 404 event -> expect status 200 + base64 body (a real resize against real S3)
printf '{"Records":[{"cf":{"request":{"uri":"/<uuid>/c/600x400/m/jpeg/<name>.jpg","querystring":""},"response":{"status":"404","statusDescription":"Not Found","headers":{}}}}]}' > /tmp/or.json
aws lambda invoke $R --function-name "$OR:$OR_NEW" --cli-binary-format raw-in-base64-out --payload file:///tmp/or.json /tmp/oro.json --query FunctionError
python3 -c "import json;d=json.load(open('/tmp/oro.json'));print('status',d['status'],'bytes',len(d.get('body','')))"
```
**If either errors, STOP** — production is still entirely on the old versions.

## 4. Repoint CloudFront associations (the cutover)
For each distribution: `get-distribution-config` → set the `LambdaFunctionARN`(s) under
`DefaultCacheBehavior.LambdaFunctionAssociations.Items` to the new version ARNs → `update-distribution`
with `--if-match <ETag>` → `aws cloudfront wait distribution-deployed` (~5–15 min, seamless).
- **images** (`ENB35KB6OG9M0`): set `viewer-request`→`$VR:$VR_NEW`, `origin-response`→`$OR:$OR_NEW` (one update).
- **cdn1** (`EHYBSK32BOWDP`): set `origin-request`→`$VR:$VR_NEW`.

## 5. Validate + rollback
- Request real images (vary w/h/quality/webp) → 200 + correct content-type; force a novel size to
  exercise OriginResponse generation. Watch `AWS/CloudFront` `5xxErrorRate` per distribution.
  *(x-cache "Error from cloudfront" on a cache-miss resize is normal — origin 404 handled by the function.)*
- **Rollback** = repoint the association(s) back to the previous version ARNs and
  `wait distribution-deployed`. Old versions are immutable and kept, so rollback is always available.

> **Cleanup:** a function version associated with a distribution can't be deleted until edge
> replicas drain (hours) — leave the previous versions in place for a while as the rollback target.

## Known pre-existing issue
The ViewerRequest handler throws on **extensionless paths** (`fwdUri.match(...)` returns null →
`match[1]`), so requests without a file extension (e.g. the root `/`) return 503. This predates the
nodejs22 migration (same in older versions) and is out of scope here — worth a future fix.
