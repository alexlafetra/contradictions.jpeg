//jpeg confession algorithm

const imageAddress = "data/clouds.jpeg";
// const imageSizeLimit = 350000; //300kB file size limit
const imageSizeLimit = 350000000; //300kB file size limit
const maxHeight = 400;
const maxWidth = 400;
let imageDimensions = {width:0,height:0};
let headerSize = 0;
let MIMEType = "";
let textEntryCursor = {
  index : 40000,
  x:0,
  y:0
};
let binaryDataString = "";
let mouseIsPressed = false;

//from: https://viereck.ch/jpeg-header/jpeg-header.js
// Author: Thomas Lochmatter, thomas.lochmatter@viereck.ch
// License: MIT

// Returns an object with the width and height of the JPEG image stored in bytes, or null if the bytes do not represent a JPEG image.
function readJpegHeader(bytes) {
	// JPEG magick
	if (bytes[0] != 0xff) return;
	if (bytes[1] != 0xd8) return;

	// Go through all markers
	let pos = 2;
	const dv = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	while (pos + 4 < bytes.byteLength) {
		// Scan for the next start marker (if the image is corrupt, this marker may not be where it is expected)
		if (bytes[pos] != 0xff) {
			pos += 1;
			continue;
		}

		const type = bytes[pos + 1];

		// Short marker
		pos += 2;
		if (bytes[pos] == 0xff) continue;

		// SOFn marker
		const length = dv.getUint16(pos);
		if (pos + length > bytes.byteLength) return;
		if (length >= 7 && (type == 0xc0 || type == 0xc2)) {
			const data = {};
			data.progressive = type == 0xc2;
			data.bitDepth = bytes[pos + 2];
			data.height = dv.getUint16(pos + 3);
			data.width = dv.getUint16(pos + 5);
			data.components = bytes[pos + 7];
      data.headerSize = pos;
      headerSize = pos;
      // headerSize = 1000;
      console.log(headerSize);
			return data;
		}

		// Other marker
		pos += length;
	}

	return;
}

function setErrorMessage(message){
  document.getElementById("error_container").style.display =(window.innerWidth<1000)?"flex":"block";
  // document.getElementById("secret_text").innerHTML = message;
}

function clearError(){
  document.getElementById("error_container").style.display = "none";
}

function openFileSelector(){
  document.getElementById("file_selector").click();
}

function resizeImageAndCanvas(){
  const isMobile = (window.innerWidth<800);
  const maxImageHeight = isMobile?(window.innerHeight - 450):(window.innerHeight);
  const maxImageWidth = isMobile?(window.innerWidth):(window.innerWidth-500)
  const img = document.getElementById('main_image');
  let sf_y = maxImageHeight/imageDimensions.height;
  let sf_x = maxImageWidth/imageDimensions.width;
  const sf = Math.min(sf_x,sf_y);
  document.body.style.setProperty("--image-width", sf*imageDimensions.width+"px");
  document.body.style.setProperty("--image-height", sf*imageDimensions.height+"px");
  img.width = imageDimensions.width * sf;
  img.height = imageDimensions.height * sf;
}

function loadNewImageFromFile(event){

  const files = event.target.files;
  MIMEType = files[0].type.split('/')[1];
  // document.getElementById("file_type_text").innerHTML = MIMEType;

  //if there are files, read em!
  if (files && files.length) {
    //if file is too big
    if(files[0].size > imageSizeLimit){
      setErrorMessage("error loading image: try a smaller file pls");
      return;
    }
    clearError();

    //read in the file
    const reader_data = new FileReader();
    reader_data.addEventListener("load",() => {
      const buffer = reader_data.result;
      loadNewImage(buffer);
    })
    reader_data.readAsArrayBuffer(files[0]);
  }
  else {
  }
}

function saveImage(){
  const htmlTextInputElement = document.getElementById("secret_input");

  //get object URL
  const objectURL = stringToURL(binaryDataString.slice(0,textEntryCursor.index)+htmlTextInputElement.value+binaryDataString.slice(textEntryCursor.index));

  //trigger a download
  const link = document.createElement('a');
  link.href = objectURL;
  link.download = 'confession.jpeg';  // desired filename
  link.click();
}

function commitTextAndStartNewEntry(){
  const htmlTextInputElement = document.getElementById("secret_input");
  const newString = binaryDataString.slice(0,textEntryCursor.index)+htmlTextInputElement.value+binaryDataString.slice(textEntryCursor.index);
  htmlTextInputElement.value = "";

  //convert datastring to uint8 array
  const byteData = new Uint8Array(newString.length);
  //add a byte for each char to the byte array
  for(let i = 0; i<newString.length; i++){
    byteData[i] = newString.charCodeAt(i);
  }
  binaryDataString = bufferToBinaryString(byteData);

  // console.log(buffer);
  setDataText();
}

//function that taxes pixel coords (x,y) and converts them to approximate string index coords
function getStringIndexFromPixelCoords(x,y){
  if(MIMEType == 'jpeg'){
    //convert coords to pixel block coords
    const blockWidth = Math.ceil(img.width/8);
    const blockHeight = Math.ceil(img.height/8);
    const totalBlocks = blockWidth * blockHeight;

    //Get the block coords from the pixel coords
    const blockX = Math.floor(x / 8);
    const blockY = Math.floor(y / 8);
    const blockIndex = blockY * blockWidth + blockX;

    //assuming all the bytes are pixel block data (they're not but it's okay)
    const bytesPerBlock = (binaryDataString.length - headerSize)/totalBlocks;
    const approxByteIndex = Math.floor(blockIndex*bytesPerBlock);

    return approxByteIndex;
  }
  else if(MIMEType == 'png'){
    //png header is 29 bytes
    const bytesPerPixel = (binaryDataString.length - 29)/(img.width*img.height);
    const pixelIndex = y * width + x;
    const approxByteIndex = Math.trunc(bytesPerPixel*pixelIndex*4);
    return approxByteIndex;
  }
}

//ONLY sets the secret text
function setInputText(){
  //set the red, secret text & scroll to it
  const secretTextElement = document.getElementById("secret_text");
  secretTextElement.innerHTML = document.getElementById("secret_input").value;
  //scroll the div to show the text that was just set
  // secretTextElement.parentNode.scrollTop = secretTextElement.offsetTop - secretTextElement.parentNode.offsetTop;

}

//sets the byte data text, and the secret text
function setDataText(){

  //set the two chunks of text that won't change
  document.getElementById("text_start").innerHTML = binaryDataString.slice(0,textEntryCursor.index);
  document.getElementById("text_end").innerHTML = binaryDataString.slice(textEntryCursor.index);
  document.getElementById("secret_text").innerHTML = document.getElementById("secret_input").value;
}

//called by the onclick event of the "enter" button
function submitText(){
  const htmlTextInputElement = document.getElementById("secret_input");
  document.getElementById("secret_text").innerHTML = htmlTextInputElement.value;
  recompileImage(binaryDataString.slice(0,textEntryCursor.index)+htmlTextInputElement.value+binaryDataString.slice(textEntryCursor.index));
}

function sliderClickHandler(){
  mouseIsPressed = true;
}
function sliderUnclickHandler(){
  mouseIsPressed = false;
}
function slideByteIndex(event){
  if(mouseIsPressed){
    //total width of the scrollbar
    const targetWidth = event.srcElement.clientWidth;
    //location of click within scrollbar
    const clickPos = event.offsetX;

    const img = document.getElementById('main_image');
    // textEntryCursor.index = binaryDataString.length*clickPos/targetWidth;
    textEntryCursor.index = Math.trunc((binaryDataString.length-headerSize)*clickPos/targetWidth)+headerSize;
    console.log(textEntryCursor.index);
    textEntryCursor.x = textEntryCursor.index%img.width;
    textEntryCursor.y = Math.trunc(textEntryCursor.index/img.width);
    document.body.style.setProperty("--byte-index-percent",clickPos/targetWidth);

    // const text = document.getElementById('binary_text_container');
    // text.scrollTop = text.scrollHeight * clickPos/targetWidth + 20;
    submitText();
  }
}

function scrollByteIndex(event){

  let ratio = 0.0;
  //if it's to the top
  if(event.target.scrollTop < event.target.clientHeight)
    ratio = (event.target.scrollTop)/event.target.scrollHeight;
  else
    ratio = (event.target.scrollTop+(event.target.clientHeight/2))/event.target.scrollHeight;
  // textEntryCursor.index = binaryDataString.length*ratio;
    textEntryCursor.index = Math.trunc((binaryDataString.length-headerSize)*ratio)+headerSize;
  document.body.style.setProperty("--byte-index-percent",ratio);

  //disable onscroll listener
  setDataText();
  submitText();
}

function stringToURL(dataString){
  //convert datastring to uint8 array
  const byteData = new Uint8Array(dataString.length);
  //add a byte for each char to the byte array
  for(let i = 0; i<dataString.length; i++){
    byteData[i] = dataString.charCodeAt(i);
  }
  //convert uint8 array to blob, and then to dataURL
  // const blob = new Blob([byteData],{ type: 'image/'+MIMEType });
  const blob = new Blob([byteData],{ type: 'image/jpeg'});
  return URL.createObjectURL(blob);
}

function recompileImage(dataString){
  const url = stringToURL(dataString);
  const newImg = document.createElement('img');
  //add an error event listener
  newImg.addEventListener("error", (event) => {
    setErrorMessage("error writing image: corrupted header or your confession was a little too honest :)");
    console.log("error writing image: corrupted header or your confession was a little too honest :)");
  });
  
  newImg.src = url;
  newImg.onload = () => {
    //resize image if it's too big
    // if(newImg.width > maxWidth || newImg.height > maxHeight){
    //   console.log('resizing image')
    //   const sf = Math.min(maxHeight/newImg.height,maxWidth/newImg.width);
    //   const newDims = {w:sf*newImg.width,h:sf*newImg.height};
    //   //create a canvas element, resize it to the correct resolution
    //   const canvas = document.createElement('canvas');
    //   canvas.width = newDims.w;
    //   canvas.height = newDims.h;
    //   //draw the image at that resolution
    //   const ctx = canvas.getContext('2d');
    //   ctx.drawImage(newImg, 0, 0, canvas.width, canvas.height);
      
    //   //reset this image
    //   canvas.toBlob((blob) => {
    //     const fileReader = new FileReader();
    //     fileReader.onload = function(event){
    //       loadNewImage(event.target.result);
    //     }
    //     fileReader.readAsArrayBuffer(blob);
    //   },'image/jpeg',1.0);

    //   return;
    // }
    clearError();
    document.getElementById('main_image').src = newImg.src;
    imageDimensions = {width:newImg.width,height:newImg.height};
    resizeImageAndCanvas();
    URL.revokeObjectURL(url);
  }
}

function bufferToBinaryString(buffer){
  let binaryString = '';
  const bytes = new Uint8Array(buffer);
  readJpegHeader(bytes);
  const len = bytes.byteLength;
  for(let i = 0; i<len; i++){
    binaryString += String.fromCharCode(bytes[i]);
  }
  return binaryString;
}

function loadNewImage(buffer){
  binaryDataString = bufferToBinaryString(buffer);
  setDataText();
  submitText();
}

function setup(){
  //get the image as a text string
  fetch(imageAddress)
    .then(result => result.arrayBuffer())
    .then(buffer => {
      MIMEType = 'jpeg';
      loadNewImage(buffer);
    });
}

window.onload = () => setup();
window.onresize = () => resizeImageAndCanvas();
/*okay so the problem is that i 
want to save a jpeg and open it in a text editor and see the text i wrote into it
*/