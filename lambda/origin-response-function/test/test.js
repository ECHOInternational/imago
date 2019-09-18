var assert = require('chai').assert;
var expect = require('chai').expect;

const clonedeep = require('lodash.clonedeep');

var lambda = require("../index.js");

var AWS = require('aws-sdk-mock');

// This is an example event from cloudfront. Duplicate and modify the duplicate for tests.
base_event = {
  "Records": [
    {
      "cf": {
        "config": {
          "distributionDomainName": "d123.cloudfront.net",
          "distributionId": "EDFDVBD6EXAMPLE",
          "eventType": "viewer-request",
          "requestId": "MRVMF7KydIvxMWfJIglgwHQwZsbG2IhRJ07sn9AkKUFSHS9EXAMPLE=="
        },
        "response": {
            "status": "200",
            "statusDescription": "OK",
            "headers": {
                "server": [
                    {
                        "key": "Server",
                        "value": "MyCustomOrigin"
                    }
                ],
                "set-cookie": [
                    {
                        "key": "Set-Cookie",
                        "value": "theme=light"
                    },
                    {
                        "key": "Set-Cookie",
                        "value": "sessionToken=abc123; Expires=Wed, 09 Jun 2021 10:18:14 GMT"
                    }
                ]
            }
        },
        "request": {
          "body": {
            "action": "read-only",
            "data": "eyJ1c2VybmFtZSI6IkxhbWJkYUBFZGdlIiwiY29tbWVudCI6IlRoaXMgaXMgcmVxdWVzdCBib2R5In0=",
            "encoding": "base64",
            "inputTruncated": false
          },
          "clientIp": "2001:0db8:85a3:0:0:8a2e:0370:7334",
          "querystring": "w=220",
          "uri": "0c6e182f-2798-4b6b-85f3-8b2119bade61/picture.jpg",
          "method": "GET",
          "headers": {
            "host": [
              {
                "key": "Host",
                "value": "d111111abcdef8.cloudfront.net"
              }
            ],
            "user-agent": [
              {
                "key": "User-Agent",
                "value": "curl/7.51.0"
              }
            ]
          },
          "origin": {
            "custom": {
              "customHeaders": {
                "my-origin-custom-header": [
                  {
                    "key": "My-Origin-Custom-Header",
                    "value": "Test"
                  }
                ]
              },
              "domainName": "example.com",
              "keepaliveTimeout": 5,
              "path": "/custom_path",
              "port": 443,
              "protocol": "https",
              "readTimeout": 5,
              "sslProtocols": [
                "TLSv1",
                "TLSv1.1"
              ]
            },
            "s3": {
              "authMethod": "origin-access-identity",
              "customHeaders": {
                "my-origin-custom-header": [
                  {
                    "key": "My-Origin-Custom-Header",
                    "value": "Test"
                  }
                ]
              },
              "domainName": "my-bucket.s3.amazonaws.com",
              "path": "/s3_path",
              "region": "us-east-1"
            }
          }
        }
      }
    }
  ]
};

describe('Base Event Object', function() {
	it('should be an object that contains a Records array', function(){
		expect(base_event).to.be.an('object');
		expect(base_event).to.have.property('Records');
		expect(base_event.Records).to.be.an('array');
	});
});

describe('Handler Function', function(){
	describe('When the original is requested', function(){
		event_original_requested = clonedeep(base_event);
		event_original_requested.Records[0].cf.request.querystring = 'o=true';
		it('should return the unmodified response object', function(done){
			lambda.handler(event_original_requested, null, function(err, res){
				expect(res).to.be.an('object');
				expect(res).to.have.property('status');
				expect(res.status).to.equal('200');
				done();
			}, done);
		});
	});
	describe('When object exists', function(){
		it('should return the unmodified response object', function(done){
			lambda.handler(clonedeep(base_event), null, function(err, res){
				expect(res).to.be.an('object');
				expect(res).to.have.property('status');
				expect(res.status).to.equal('200');
				done();
			}, done);
		});
	});
	describe('When object does not exist', function(){
		event_image_not_exist = clonedeep(base_event);
		event_image_not_exist.Records[0].cf.response.status = 404;
		describe('When invalid parameters are sent', function(){
			event_image_not_exist_bad_uri = clonedeep(event_image_not_exist);
			event_image_not_exist_bad_uri.Records[0].cf.request.uri = "0c6e182f-2798-4b6b-85f3-8b2119bade61/picture.jpg"; //Invalid Uri
			it('should return an error code 400', function(done){
				lambda.handler(event_image_not_exist_bad_uri, null, function(err, res){
					expect(res).to.be.an('object');
					expect(res).to.have.property('status');
					expect(res.status).to.equal(400);
					done();
				}, done);
			});
		});
		describe('When valid parameters are sent', function(){

      // Loads an image from the local directory instead of calling S3
			AWS.mock("S3", "getObject", function(params, callback){
				callback(null, {
					Body: Buffer.from(require("fs").readFileSync("./test/test.jpg")),
					Bucket: 'image-resize-test-382724554857-us-east-1',
					ContentType: 'image/jpeg',
					CacheControl: 'max-age=31536000',
					Key: 'c6e182f-2798-4b6b-85f3-8b2119bade60/w/400/m/jpg/picture.jpg',
					StorageClass: 'STANDARD'
				});
			});
      
      // Does not create any images.
      // To actually create images during testing comment out this mock section
			AWS.mock("S3", "putObject", function(params, callback){
				console.log(params);
				callback(null, "uploaded.");
			});
      //

			it('should return a 200 success code', function(done){
				event_image_not_exist_width_400 = clonedeep(base_event);
				event_image_not_exist_width_400.Records[0].cf.response.status = 404;
				event_image_not_exist_width_400.Records[0].cf.request.uri = "0c6e182f-2798-4b6b-85f3-8b2119bade60/w/400/m/jpg/picture%20of%20me.jpg";
				lambda.handler(event_image_not_exist_width_400, null, function(err, res){
					expect(res).to.be.an('object');
					expect(res).to.have.property('status');
					expect(res.status).to.equal(200);
					done();
				}, done);
			});
		});
	});
});
