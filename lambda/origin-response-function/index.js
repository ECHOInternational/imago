/* jshint node: true */
'use strict';

const http = require('http');
const https = require('https');
const querystring = require('querystring');

const AWS = require('aws-sdk');

const Sharp = require('sharp');

// set the S3 and API GW endpoints
const BUCKET = 'images-us-east-1.echocommunity.org';

exports.handler = (event, context, callback) => {

  const S3 = new AWS.S3({
    signatureVersion: 'v4',
  });

  let response = event.Records[0].cf.response;
  // console.log(event.Records[0].cf);

  // console.log("Response status code :%s", response.status);

  //check if image is not present
  if (response.status == 404) {

    let request = event.Records[0].cf.request;
    let params = querystring.parse(request.querystring);

    let original;
    if(params.original){
        original = params.original;
    }else if(params.o){
        original = params.o;
    }

    // If the original has been requested stop processing
    // and return it.
    if(original == 'true'){
        callback(null, response);
        return;
    }

    // read the required path. Ex: uri /images/100x100/webp/image.jpg
    let path = request.uri;

    // read the S3 key from the path variable.
    // Ex: path variable /images/100x100/webp/image.jpg
    // this removes the first character.
    let key = path.substring(1);

    key = decodeURIComponent(key);

    // parse the prefix, width, height and image name
    // Ex: key=images/200x200/webp/image.jpg
    let prefix, func, fit, quality, originalKey, match, width, height, requiredFormat, imageName;
    let startIndex;

    // Looks for any of our function ids (w,h,c,f) followed by a slash then a number
    let prefix_matcher = key.match(/(.*)(\/[w,h,c,f]\/[0-9])/);
    if(prefix_matcher){
      prefix = prefix_matcher[1];
    }

    // these ignore the prefix
    // THIS matches items with width or height, not both
    let one_dimension_matcher = key.match(/\/([w,h])\/(\d+)\/([m,l,h])\/(.*)\/(.*)/);

    // THIS matches items with both width and height
    let two_dimension_matcher = key.match(/\/([c,f])\/(\d+)x(\d+)\/([m,l,h])\/(.*)\/(.*)/);


    if(one_dimension_matcher){
      func = one_dimension_matcher[1];
      if(func == 'w'){
        width = parseInt(one_dimension_matcher[2], 10);
      }else{
        height = parseInt(one_dimension_matcher[2], 10);
      }
      quality = one_dimension_matcher[3];
      requiredFormat = one_dimension_matcher[4] == "jpg" ? "jpeg" : one_dimension_matcher[4];
      imageName = one_dimension_matcher[5];
    }else if(two_dimension_matcher){
      func = two_dimension_matcher[1];
      width = parseInt(two_dimension_matcher[2], 10);
      height = parseInt(two_dimension_matcher[3], 10);
      quality = two_dimension_matcher[4];
      requiredFormat = two_dimension_matcher[5] == "jpg" ? "jpeg" : two_dimension_matcher[5];
      imageName = two_dimension_matcher[6];
    }else {
      // RAISE AN ERROR THIS DOESN'T MATCH ANY KNOWN PATTERNS.
      response.status = 400;
      response.statusDescription = 'Bad Request';
      response.body = 'The request does not match any known patterns';
      callback(null, response);
      return;
    }

    if(prefix){
      originalKey = prefix + "/" + imageName;
    }else{
      originalKey = imageName;
    }

    if(func == 'c'){
      fit = 'cover';
    }else{
      fit = 'inside';
    }

    let format_options = {quality: 60};

    switch(quality){
      case 'l':
        format_options.quality = 40;
        break;
      case 'h':
        format_options.quality = 80;
        break;
      default:
        format_options.quality = 60;
    }

    // get the source image file
    S3.getObject({ Bucket: BUCKET, Key: originalKey }).promise()
      // perform the resize operation
      .then(data => Sharp(data.Body)
        .resize({
          width: width,
          height: height,
          fit: fit,
        })
        .toFormat(requiredFormat, format_options)
        .toBuffer()
      )
      .then(buffer => {
        // save the resized object to S3 bucket with appropriate object key.
        S3.putObject({
            Body: buffer,
            Bucket: BUCKET,
            ContentType: 'image/' + requiredFormat,
            CacheControl: 'max-age=31536000',
            Key: key,
            StorageClass: 'STANDARD'
        }).promise()
        // even if there is exception in saving the object we send back the generated
        // image back to viewer below
        .catch(() => { console.log("Exception while writing resized image to bucket")});

        // generate a binary response with resized image
        response.status = 200;
        response.body = buffer.toString('base64');
        response.bodyEncoding = 'base64';
        response.headers['content-type'] = [{ key: 'Content-Type', value: 'image/' + requiredFormat }];
        callback(null, response);
      })
    .catch( err => {
      console.log("Exception while reading source image :%j",err);
      console.log("Key Passed: %j",originalKey);
      response.status = 404;
      response.statusDescription = 'Not Found';
      response.body = 'The file requested does not exist.';
      callback(null, response);
    });
  } // end of if block checking response statusCode
  else {
    // allow the response to pass through
    callback(null, response);
  }
};