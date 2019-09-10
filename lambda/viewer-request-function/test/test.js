var assert = require('chai').assert;
var expect = require('chai').expect;

const clonedeep = require('lodash.clonedeep');

var lambda = require("../index.js");

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
        "request": {
          "body": {
            "action": "read-only",
            "data": "eyJ1c2VybmFtZSI6IkxhbWJkYUBFZGdlIiwiY29tbWVudCI6IlRoaXMgaXMgcmVxdWVzdCBib2R5In0=",
            "encoding": "base64",
            "inputTruncated": false
          },
          "clientIp": "2001:0db8:85a3:0:0:8a2e:0370:7334",
          "querystring": "size=large",
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
	it('should return an object that has a uri property', function(done){
		lambda.handler(clonedeep(base_event), null, function(err, res){
			expect(res).to.be.an('object');
			expect(res).to.have.property('uri');
			done();
		}, done);
	});
	describe('original parameter', function(){
		let uri_value_before_modification = clonedeep(base_event.Records[0].cf.request.uri);
		describe('when short parameter is set to true', function(){
			it('should return with an unmodified uri', function(done){
				base_event_o_true = clonedeep(base_event);
				base_event_o_true.Records[0].cf.request.querystring = "o=true";
				lambda.handler(base_event_o_true, null, function(err, res){
					expect(res.uri).to.equal(uri_value_before_modification);
					done();
				}, done);	
			});
		});
		describe('when long parameter is set to true', function(){
			it('should return with an unmodified uri', function(done){
				base_event_o_true = clonedeep(base_event);
				base_event_o_true.Records[0].cf.request.querystring = "original=true";
				lambda.handler(base_event_o_true, null, function(err, res){
					expect(res.uri).to.equal(uri_value_before_modification);
					done();
				}, done);	
			});
		});
		describe('when parameter is set to false', function(){
			it('should not return with an unmodified uri', function(done){
				base_event_o_false = clonedeep(base_event);
				base_event_o_false.Records[0].cf.request.querystring = "original=false";
				lambda.handler(base_event_o_false, null, function(err, res){
					expect(res.uri).to.not.equal(uri_value_before_modification);
					done();
				}, done);	
			});
		});
	});
	describe('when only a width parameter is passed', function(){
		it('should return with a function indicator w', function(done){
			base_event_width_only = clonedeep(base_event);
			base_event_width_only.Records[0].cf.request.querystring = "width=900";
			lambda.handler(base_event_width_only, null, function(err, res){
				expect(res.uri).to.contain('/w/');
				done();
			}, done);	
		});
		it('should return with the specified width argument', function(done){
			base_event_width_only = clonedeep(base_event);
			base_event_width_only.Records[0].cf.request.querystring = "w=900";
			lambda.handler(base_event_width_only, null, function(err, res){
				expect(res.uri).to.contain('/w/900/');
				done();
			}, done);	
		});
		it('should limit the width minimum size', function(done){
			base_event_width_only = clonedeep(base_event);
			base_event_width_only.Records[0].cf.request.querystring = "w=10";
			lambda.handler(base_event_width_only, null, function(err, res){
				expect(res.uri).to.contain('/w/100/');
				done();
			}, done);
		});
		it('should limit the width maximum size', function(done){
			base_event_width_only = clonedeep(base_event);
			base_event_width_only.Records[0].cf.request.querystring = "w=5000";
			lambda.handler(base_event_width_only, null, function(err, res){
				expect(res.uri).to.contain('/w/4100/');
				done();
			}, done);
		});
		it('should round down to the nearest 100', function(done){
			base_event_width_only = clonedeep(base_event);
			base_event_width_only.Records[0].cf.request.querystring = "w=240";
			lambda.handler(base_event_width_only, null, function(err, res){
				expect(res.uri).to.contain('/w/200/');
				done();
			}, done);
		});
		it('should round up to the nearest 100', function(done){
			base_event_width_only = clonedeep(base_event);
			base_event_width_only.Records[0].cf.request.querystring = "w=251";
			lambda.handler(base_event_width_only, null, function(err, res){
				expect(res.uri).to.contain('/w/300/');
				done();
			}, done);
		});
	});
	describe('when only a height parameter is passed', function(){
		it('should return with a function indicator h', function(done){
			base_event_height_only = clonedeep(base_event);
			base_event_height_only.Records[0].cf.request.querystring = "height=200";
			lambda.handler(base_event_height_only, null, function(err, res){
				expect(res.uri).to.contain('/h/');
				done();
			}, done);	
		});
		it('should return with the specified height argument', function(done){
			base_event_height_only = clonedeep(base_event);
			base_event_height_only.Records[0].cf.request.querystring = "h=200";
			lambda.handler(base_event_height_only, null, function(err, res){
				expect(res.uri).to.contain('/h/200/');
				done();
			}, done);	
		});
		it('should limit the height minimum size', function(done){
			base_event_height_only = clonedeep(base_event);
			base_event_height_only.Records[0].cf.request.querystring = "h=10";
			lambda.handler(base_event_height_only, null, function(err, res){
				expect(res.uri).to.contain('/h/100/');
				done();
			}, done);
		});
		it('should limit the height maximum size', function(done){
			base_event_height_only = clonedeep(base_event);
			base_event_height_only.Records[0].cf.request.querystring = "h=5000";
			lambda.handler(base_event_height_only, null, function(err, res){
				expect(res.uri).to.contain('/h/4100/');
				done();
			}, done);
		});
		it('should round down to the nearest 100', function(done){
			base_event_height_only = clonedeep(base_event);
			base_event_height_only.Records[0].cf.request.querystring = "h=240";
			lambda.handler(base_event_height_only, null, function(err, res){
				expect(res.uri).to.contain('/h/200/');
				done();
			}, done);
		});
		it('should round up to the nearest 100', function(done){
			base_event_height_only = clonedeep(base_event);
			base_event_height_only.Records[0].cf.request.querystring = "h=251";
			lambda.handler(base_event_height_only, null, function(err, res){
				expect(res.uri).to.contain('/h/300/');
				done();
			}, done);
		});
	});
	describe('when both a height and width parameter are passed', function(){
		describe('when no transform function is specified', function(){
			it('should return with a default function indicator c', function(done){
				base_event_h_w_default = clonedeep(base_event);
				base_event_h_w_default.Records[0].cf.request.querystring = "height=1200&width=1300";
				lambda.handler(base_event_h_w_default, null, function(err, res){
					expect(res.uri).to.contain('/c/');
					done();
				}, done);	
			});
			it('should return with the specified height and width argument', function(done){
				base_event_h_w_default = clonedeep(base_event);
				base_event_h_w_default.Records[0].cf.request.querystring = "h=1200&w=1300";
				lambda.handler(base_event_h_w_default, null, function(err, res){
					expect(res.uri).to.contain('/c/1300x1200/');
					done();
				}, done);	
			});
		});
		describe('when transform function is specified as crop', function(){
			it('should return with a indicator c', function(done){
				base_event_h_w_default = clonedeep(base_event);
				base_event_h_w_default.Records[0].cf.request.querystring = "height=1200&width=1300&t=crop";
				lambda.handler(base_event_h_w_default, null, function(err, res){
					expect(res.uri).to.contain('/c/');
					done();
				}, done);	
			});
		});
		describe('when transform function is specified as fit', function(){
			it('should return with a indicator f', function(done){
				base_event_h_w_default = clonedeep(base_event);
				base_event_h_w_default.Records[0].cf.request.querystring = "height=1200&width=1300&transform=f";
				lambda.handler(base_event_h_w_default, null, function(err, res){
					expect(res.uri).to.contain('/f/');
					done();
				}, done);	
			});
			it('should return with the specified height and width argument', function(done){
				base_event_h_w_default = clonedeep(base_event);
				base_event_h_w_default.Records[0].cf.request.querystring = "h=1200&w=1300&t=fit";
				lambda.handler(base_event_h_w_default, null, function(err, res){
					expect(res.uri).to.contain('/f/1300x1200/');
					done();
				}, done);	
			});
			it('should round and limit the width and height parameters', function(done){
				base_event_h_w_default = clonedeep(base_event);
				base_event_h_w_default.Records[0].cf.request.querystring = "h=251&w=5200&t=fit";
				lambda.handler(base_event_h_w_default, null, function(err, res){
					expect(res.uri).to.contain('/f/4100x300/');
					done();
				}, done);	
			});
		});
	});
	describe('quality parameter', function(){
		describe('when parameter is not set', function(){
			it('should return with the default value of m', function(done){
				base_event_p = clonedeep(base_event);
				base_event_p.Records[0].cf.request.querystring = "";
				lambda.handler(base_event_p, null, function(err, res){
					expect(res.uri).to.contain('/m/');
					done();
				}, done);	
			});
		});
		describe('when long parameter is set', function(){
			it('should return with the passed value', function(done){
				base_event_p = clonedeep(base_event);
				base_event_p.Records[0].cf.request.querystring = "quality=l";
				lambda.handler(base_event_p, null, function(err, res){
					expect(res.uri).to.contain('/l/');
					done();
				}, done);	
			});
		});
		describe('when short parameter is set', function(){
			it('should return with the passed value', function(done){
				base_event_p = clonedeep(base_event);
				base_event_p.Records[0].cf.request.querystring = "quality=h";
				lambda.handler(base_event_p, null, function(err, res){
					expect(res.uri).to.contain('/h/');
					done();
				}, done);	
			});
		});
		describe('when long parameter values are used', function(){
			it('should return h when passed high', function(done){
				base_event_p = clonedeep(base_event);
				base_event_p.Records[0].cf.request.querystring = "quality=high";
				lambda.handler(base_event_p, null, function(err, res){
					expect(res.uri).to.contain('/h/');
					done();
				}, done);	
			});
			it('should return m when passed medium', function(done){
				base_event_p = clonedeep(base_event);
				base_event_p.Records[0].cf.request.querystring = "quality=medium";
				lambda.handler(base_event_p, null, function(err, res){
					expect(res.uri).to.contain('/m/');
					done();
				}, done);	
			});
			it('should return l when passed low', function(done){
				base_event_p = clonedeep(base_event);
				base_event_p.Records[0].cf.request.querystring = "quality=low";
				lambda.handler(base_event_p, null, function(err, res){
					expect(res.uri).to.contain('/l/');
					done();
				}, done);	
			});
		});
	});
	describe('accept header', function(){
		describe('when accept header is not present', function(){
			it('should return a jpeg object when a jpeg object is requested', function(done){
				lambda.handler(clonedeep(base_event), null, function(err, res){
					expect(res.uri).to.contain('/jpg/');
					done();
				}, done);
			});
		});
		describe('when accept header requests webp', function(){
			it('should return a webp object when a jpeg object is requested', function(done){
				base_event_webp = clonedeep(base_event);
				base_event_webp.Records[0].cf.request.headers['accept'] = [{ "key": "Accept", "value": "image/webp"}];
				lambda.handler(base_event_webp, null, function(err, res){
					expect(res.uri).to.contain('/webp/');
					done();
				}, done);
			});
		});
		describe('when accept header requests jpeg', function(){
			it('should return a jpeg object when a jpeg object is requested', function(done){
				base_event_webp = clonedeep(base_event);
				base_event_webp.Records[0].cf.request.headers['accept'] = [{ "key": "Accept", "value": "image/jpeg"}];
				lambda.handler(base_event_webp, null, function(err, res){
					expect(res.uri).to.contain('/jpg/');
					done();
				}, done);
			});
		});
	});
	describe('when no valid parameters are passed', function(){
		it('should return a uri with default values', function(done){
			lambda.handler(base_event, null, function(err, res){
				expect(res.uri).to.be.a('string');
				expect(res.uri).to.include('/c/600x400/m/jpg/picture.jpg');
				done();
			}, done);
		});
	});
});
