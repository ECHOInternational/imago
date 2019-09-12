# Imago
Lambda @edge image resizing based on the demo from AWS

## Installation:

1) From project root folder, run the following commands:

    ```BASH
    docker build --tag amazonlinux:nodejs .
    ```
    _Note the . (dot) at the end, it is easily missed and is required to specify the current directory._

    The Dockerfile is configured to download Amazon Linux and install Node.js 8.10 along with dependencies.

2) Set the bucket and cloudfront distribution names in the appropriate files:
    + imago/lambda/origin-response-function/index.js
    + imago/cloud-formation-template.yml

    The default bucket name is:  image-resize-test-${AWS::AccountId}-${AWS::Region}
    
    A cloudfront distribution with a domain beginning with this value will be created.
    
    You must change the bucket name on this line in the origin-response-function in order for this to work:
    
    ```JAVASCRIPT
    const BUCKET = 'image-resize-test-<your account number>-us-east-1';
    ```

    For example, if your AWS Account ID is 123456789012, then BUCKET variable would be updated to ‘image-resize-test-123456789012-us-east-1’. If you already have an S3 bucket then update this variable accordingly and modify your CloudFront distribution Origin settings to reflect the same.

3) Install the sharp and querystring module dependencies and compile the ‘Origin-Response’ function.

    ```BASH
    docker run --rm --volume ${PWD}/lambda/origin-response-function:/build amazonlinux:nodejs /bin/bash -c "source ~/.bashrc; npm init -f -y; npm install sharp --save; npm install querystring --save; npm install --only=prod"
    ```

4) Install the querystring module dependencies and compile the ‘Viewer-Request’ function.

    ```BASH
    docker run --rm --volume ${PWD}/lambda/viewer-request-function:/build amazonlinux:nodejs /bin/bash -c "source ~/.bashrc; npm init -f -y; npm install querystring --save; npm install --only=prod"
    ```

5) Package the ‘Origin-Response’ function.

    ```BASH
    mkdir -p dist && cd lambda/origin-response-function && zip -FS -q -r ../../dist/origin-response-function.zip * && cd ../..
    ```

6) Package the ‘Viewer-Request’ function.
    
    ```BASH
    mkdir -p dist && cd lambda/viewer-request-function && zip -FS -q -r ../../dist/viewer-request-function.zip * && cd ../..
    ```

7) Choose a bucket in the __us-east-1__ region to hold the deployment files and upload the zip files created in above steps. If you don't already have an appropriate bucket in that region you can create one using the AWS console or command line tools. These files will be referenced from the CloudFormation template during the next step.

8) In the `imago/cloud-formation-template.yml` file update the `<code-bucket>`placeholders with the bucket name you used in the last step.

9) Using cloudformation (either cli or the AWS console) deploy the cloudformation template `imago/cloud-formation-template.yml`

    This will take some time as the cloudfront distribution creation is an extensive process. You can expect up to 20 minutes for this to complete.

## How to use this:

1) Upload an high-resolution image to the bucket you created. (eg. images/image.jpg)
2) In a browser navigate to `https://{cloudfront-domain}/images/image.jpg?w=400`

    Replace cloudfont-domain with the domain name of the cloudfront distribution created during installation. DON'T use the S3 bucket or you won't see any changes.

    You should see a resized image that is just 400px wide.

    If you look in the bucket you would see a new file: `/<bucket-name>/images/w/400/m/jpg/image.jpg`

    If your web browser supports webm you might see this file: `/<bucket-name>/images/w/400/m/webm/image.jpg`

### Parameters

+ **o= or original=** Requests the original file with no transformation or compression applied. _When used all other parameters are ignored._
+ **w= or width=** Sets the desired width. If used without the height parameter the image will be scaled propotionally to the width specified. _Values rounded to the nearest 100._
+ **h= or height=** Sets the desired height. If used without the width parameter the image will be scaled propotionally to the height specified. _Values rounded to the nearest 100._
+ **t= or transform=** Only used when both width and height are specified. Possible values:
    * "c" or "crop": Crop the image to the specified dimensions. **Default**
    * "f" or "fit": Fit the image within the specified dimension.
+ **q= or quality=** Specifies a compression amount for jpeg and webp images. Possible values:
    * "l" or "low": Sets quality at 40
    * "m", "med", or "medium": Sets quality at 60 **Default**
    * "h" or "high": Sets quality at 80

### Headers

If the client passes an Accept header that indicates that webp is an acceptable format (Chrome and Android do) a webp image is created instead of a jpeg when jpeg is requested.

### What is created?

S3 keys are constructed following this pattern

/prefix/transform/widthxheight/quality/filetype/filename.extension

#### Examples:

12345/myimage.jpg?w=400 yeilds\
/12345/w/400/m/jpg/myimage.jpg\
_note that the default value of medium quality is used_

12345/myimage.jpg?h=400 yeilds\
/12345/h/400/m/jpg/myimage.jpg

12345/myimage.jpg?w=100&h=100 yeilds\
/12345/c/100x100/m/jpg/myimage.jpg\
_note that the default values of crop and medium quality are used_

12345/myimage.jpg?w=600&h=400&t=f yeilds\
/12345/f/600x400/m/jpg/myimage.jpg

12345/myimage.jpg?w=1200&q=h yeilds\
/12345/w/1200/h/jpg/myimage.jpg


-------

Original source for these functions from:
https://aws.amazon.com/blogs/networking-and-content-delivery/resizing-images-with-amazon-cloudfront-lambdaedge-aws-cdn-blog/

Image resizing done using Sharp:
https://sharp.pixelplumbing.com

## Testing

1) Ensure you have Node 8.10 installed
2) Clone the repository
3) Test the viewer request function
    go to the `imago/lambda/viewer-request-function` folder
    
    ```BASH
    npm test
    ```

4) Test the origin response function
    go to the `imago/lambda/origin-response-function` folder
    
    ```BASH
    npm test
    ```

    These tests operate on a local image and do not access S3. You can comment out the mock sections to see it operate on live files.


