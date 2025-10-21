const imageAddress = "data/clouds.jpeg";
const imageSizeLimit = 350000; //300kB file size limit
let headerSize = 0;
let MIMEType = "";
let img;
let textEntryCursor = {
  index : 40000,
  x:0,
  y:0
};

let binaryDataString = "";

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
			return data;
		}

		// Other marker
		pos += length;
	}

	return;
}

function setErrorMessage(message){
  document.getElementById("error_container").style.display =(window.innerWidth<1000)?"flex":"block";
  document.getElementById("secret_text").innerHTML = message;
}

function clearError(){
  document.getElementById("error_container").style.display = "none";
}

function openFileSelector(){
  document.getElementById("file_selector").click();
}

function resizeImageAndCanvas(){
    let sf_x = 1;
    let sf_y = 1;
    const isMobile = (window.innerWidth<1000);
    const maxImageHeight = isMobile?(window.innerHeight - 450):(window.innerHeight - 250);
    const maxImageWidth = isMobile?(window.innerWidth):(window.innerWidth-500)
    if(img.height > maxImageHeight){
      sf_y = maxImageHeight/img.height;
    }
    if(img.width > maxImageWidth){
      sf_x = maxImageWidth/img.width;
    }
    const sf = Math.min(sf_x,sf_y);
    resizeCanvas(img.width*sf,img.height*sf);
    document.body.style.setProperty("--image-width", width+"px");
    document.body.style.setProperty("--image-height", height+"px");
    rerender();
}

function windowResized(){
  resizeImageAndCanvas();
}

async function loadNewImage(event){

  const files = event.target.files;
  MIMEType = files[0].type.split('/')[1];
  document.getElementById("file_type_text").innerHTML = MIMEType;

  //if there are files, read em!
  if (files && files.length) {
    //if file is too big
    if(files[0].size > imageSizeLimit){
      setErrorMessage("error loading image: try a smaller file pls");
      return;
    }
    clearError();
    const reader_image = new FileReader();
    //when file reader is done, use p5js to load the file
    reader_image.addEventListener("load",() => {
      //when the image is loaded, resize canvas and rerender
      //Also, get a new binary string!
      loadImage(reader_image.result,(newImg)=>{
        img = newImg;
        resizeImageAndCanvas(img);
      });
    });
    reader_image.readAsDataURL(files[0]);

    //add a second reader
    const reader_data = new FileReader();
    reader_data.addEventListener("load",() => {
      const buffer = reader_data.result;
      binaryDataString = bufferToBinaryString(buffer);
      setDataText();
    })
    reader_data.readAsArrayBuffer(files[0]);
  }
  else {
  }
}

function saveImage(){
  img.save(document.getElementById("secret_text").innerHTML,MIMEType);
}


function rerender(){
  background(255);
  image(img,-width/2,-height/2,width,height);
  //cursor rectangle
  fill(255,0,100,200);
  noStroke();
  rect(textEntryCursor.x-width/2,textEntryCursor.y-height/2,8,16)
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
    const approxByteIndex = Math.trunc(bytesPerPixel*pixelIndex);
    return approxByteIndex;
  }
}

function setInputText(){
  //set the red, secret text & scroll to it
  const secretTextElement = document.getElementById("secret_text");
  secretTextElement.innerHTML = document.getElementById("secret_input").value;
  //scroll the div to show the text that was just set
  secretTextElement.parentNode.scrollTop = secretTextElement.offsetTop - secretTextElement.parentNode.offsetTop;

}

function setDataText(){
  //set the two chunks of text that won't change
  document.getElementById("text_start").innerHTML = binaryDataString.slice(0,textEntryCursor.index);
  document.getElementById("text_end").innerHTML = binaryDataString.slice(textEntryCursor.index);
  setInputText();
}

//called by the onclick event of the "enter" button
function submitText(){
  const htmlTextInputElement = document.getElementById("secret_input");
  recompileImage(binaryDataString.slice(0,textEntryCursor.index)+htmlTextInputElement.value+binaryDataString.slice(textEntryCursor.index));
  setInputText();
}

function mouseClicked(){
  if(mouseX<width && mouseY < height && mouseX > 0 && mouseY >0){
    textEntryCursor = {
      x:Math.trunc(mouseX),
      y:Math.trunc(mouseY),
      index : getStringIndexFromPixelCoords(mouseX,mouseY)
    };
    document.getElementById("coordinate_text").innerHTML = '('+textEntryCursor.x+","+textEntryCursor.y+')';
    submitText();
    setDataText();
  }
}

function recompileImage(dataString){
  //convert datastring to uint8 array
  const byteData = new Uint8Array(dataString.length);
  for(let i = 0; i<dataString.length; i++){
    byteData[i] = dataString.charCodeAt(i);
  }
  //convert uint8 array to blob, and then to dataURL
  const blob = new Blob([byteData],{ type: 'image/'+MIMEType });
  const url = URL.createObjectURL(blob);

  img = loadImage(url,
  //successful load callback
  ()=>{
    //draw the new image, when it's ready
    rerender();
    //delete url
    URL.revokeObjectURL(url);
    clearError();
  },
  //error callback
  (error) => {
    setErrorMessage("error writing image: corrupted header or your confession was a little too honest :)");
    console.log("uh oh!",error);
  });
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

async function preload(){
  img = await loadImage(imageAddress);
  MIMEType = 'jpeg';
}

function setup(){
  //get the image as a text string
  fetch(imageAddress)
    .then(result => result.arrayBuffer())
    .then(buffer => {
      binaryDataString = bufferToBinaryString(buffer);
      setDataText();
    });
  createCanvas(img.width,img.height,WEBGL);
  resizeImageAndCanvas(img);
  rerender();
  noLoop();
}
