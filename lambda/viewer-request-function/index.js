/* jshint node: true */
'use strict';

// Transforms the request reading any arguments sent, placing restrictions on those
// this acts like a filter, requests are processed and transformed here before they
// go further through the process. This doesn't do any image processing.


const querystring = require('querystring');

// defines the allowed dimensions, default dimensions and how much variance from allowed
// dimension is allowed.

// requests look like this:
// sub.domain.tld/uuid/filename.ext?

// Parameters
// o or original = boolean (all other arguments ignored if true)
// w or width  = integer between 50 and 4100(4k)
// h or height = integer between 50 and 4100
// t or transform = string value "crop" or "fit" (defaults to crop, both width and height required)
// q or quailty = string value "l" or "low", "m" or "med" or "medium", "h" or "high"

// If o is specified, the original image is returned

// if w or h is specified, but not both, the image will be scaled to match the dimension specified with the integer provided

// if both w and h are specified and t is anything other than fit the image will be resized to match the smaller dimension
// then the other dimension will be cropped to the integer provided

// if both w and h are specified and t is fit then the image will be resized to fit within the dimensions provided.

const variables = {
        width : {min:100,max:4100,default:600},
        height : {min:100,max:4100,default:400},
        roundToNearest: 100,
        defaults: {quality:'m',transform:'c'},
        webpExtension: 'webp'
  };

exports.handler = (event, context, callback) => {
    const request = event.Records[0].cf.request;
    const headers = request.headers;

    // parse the querystrings key-value pairs.
    const params = querystring.parse(request.querystring);
    // fetch the uri of original image
    let fwdUri = request.uri;

    let width, height, original, transform, quality, mode;

    if(params.original){
        original = params.original;
    }else if(params.o){
        original = params.o;
    }

    // If the original has been requested stop processing
    // and return it.
    if(original == 'true'){
        callback(null, request);
        return;
    }

    if(params.width){
        width = params.width;
    }else if(params.w){
        width = params.w;
    }

    if(params.height){
        height = params.height;
    }else if(params.h){
        height = params.h;
    }
    
    // If no width or height parameters are passed, set them as defaults
    if(!params.width && !params.height && !params.w && !params.h){
        width = variables.width.default;
        height = variables.height.default;
    }

    if(params.transform){
        transform = params.transform;
    }else if(params.t){
        transform = params.t;
    }

    //Limit transform methods and set default
    switch(transform){
        case "f":
        case "fit":
            transform = "f";
            break;
        default:
            transform = "c";
    }

    if(params.quality){
        quality = params.quality;
    }else if(params.q){
        quality = params.q;
    }

    // Limit quality settings and set default
    switch(quality){
        case "l":
        case "low":
            quality = "l";
            break;
        case "m":
        case "med":
        case "medium":
            quality = "m";
            break;
        case "h":
        case "high":
            quality = "h";
            break;
        default:
            quality = variables.defaults.quality;
    }

    // What processing was requested?
    if(width && height){
        mode = transform;
    }else if(width){
        mode = "w";
    }else if(height){
        mode = "h";
    }else{
        mode = variables.defaults.transform;
    }

    // parse the prefix, image name and extension from the uri.

    const match = fwdUri.match(/(.*)\/(.*)\.(.*)/);

    let prefix = match[1];
    let imageName = match[2];
    let extension = match[3];

    // read the accept header to determine if webP is supported.
    let accept = headers['accept']?headers['accept'][0].value:"";

    let url = [];
    // build the new uri to be forwarded upstream
    url.push(prefix);
    url.push(mode);

    // TODO: ROUND AND LIMIT WIDTH AND HEIGHT VALUES!!
    switch(mode){
        case "w":
            url.push(round_and_limit(width, variables.width.min, variables.width.max, variables.roundToNearest));
            break;
        case "h":
            url.push(round_and_limit(height, variables.height.min, variables.height.max, variables.roundToNearest));
            break;
        default:
            url.push(round_and_limit(width, variables.width.min, variables.width.max, variables.roundToNearest)+"x"+round_and_limit(height, variables.height.min, variables.height.max, variables.roundToNearest));
    }

    url.push(quality);
  
    // check support for webp
    if (accept.includes(variables.webpExtension)) {
        url.push(variables.webpExtension);
    }
    else{
        let format = extension.toLowerCase();
        if(format ==  "jpg"){
            format = "jpeg";
        }
        url.push(format);
    }
    url.push(imageName+"."+extension);

    fwdUri = url.join("/");

    // final modified url is of format /uuid/w/600/webp/image.jpg
    // examples:
    // /uuid/w/300/l/jpg/image.jpg
    // /uuid/h/500/m/webp/image.jpg
    // /uuid/f/600x400/h/jpg/image.jpg
    // /uuid/c/100x100/l/jpg/image.jpg
    request.uri = fwdUri;
    callback(null, request);
};

function round_and_limit(value, low_limit, high_limit, rounding_value){
    let roundvalue = Math.round((value)/rounding_value)*rounding_value;
    
    if(roundvalue < low_limit) return low_limit;
    if(roundvalue > high_limit) return high_limit;

    return roundvalue;
}