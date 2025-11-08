//jpeg confession algorithm

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

function compareStrings(str1,str2){
  if(str1.length != str2.length)
    console.log("strings different lengths!");
  for(let i = 0; i<str1.length; i++){
    if(str1.charAt(i) !== str2.charAt(i)){
      console.log("1st difference at index "+i+" --> "+str1.charAt(i)+' != '+str2.charAt(i));
      return;
    }
  }
}

function setErrorMessage(message){
  // document.getElementById("error_container").style.display =(window.innerWidth<1000)?"flex":"block";
  // document.getElementById("secret_text").innerHTML = message;
  // document.getElementById("test").src = "data/xp_error.png";
}

function clearError(){
  // document.getElementById("error_container").style.display = "none";
  // recompileImage(binaryDataString);
}

function openFileSelector(){
  document.getElementById("file_selector").click();
}

function resizeImageAndCanvas(){
    const isMobile = (window.innerWidth<1000);
    const maxImageHeight = isMobile?(window.innerHeight - 450):(window.innerHeight - 250);
    const maxImageWidth = isMobile?(window.innerWidth):(window.innerWidth-500)
    let sf_y = maxImageHeight/img.height;
    let sf_x = maxImageWidth/img.width;
    const sf = Math.min(sf_x,sf_y);
    document.body.style.setProperty("--image-width", width+"px");
    document.body.style.setProperty("--image-height", height+"px");
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
  // setInputText();
}

//called by the onclick event of the "enter" button
function submitText(){
  const htmlTextInputElement = document.getElementById("secret_input");
  recompileImage(binaryDataString.slice(0,textEntryCursor.index)+htmlTextInputElement.value+binaryDataString.slice(textEntryCursor.index));
}

function slideByteIndex(event){
  if(mouseIsPressed){
    //total width of the scrollbar
    const targetWidth = event.srcElement.clientWidth;
    //location of click within scrollbar
    const clickPos = event.offsetX;

  
    textEntryCursor.index = binaryDataString.length*clickPos/targetWidth;
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
  if(event.target.scrollTop < event.target.clientHeight/2)
    ratio = (event.target.scrollTop)/event.target.scrollHeight;
  else
    ratio = (event.target.scrollTop+(event.target.clientHeight/2))/event.target.scrollHeight;
  textEntryCursor.index = binaryDataString.length*ratio;
  document.body.style.setProperty("--byte-index-percent",ratio);

  //disable onscroll listener
  setDataText();
  submitText();
}

function keyPressed(){
  let newEntryCoords = {x:textEntryCursor.x,y:textEntryCursor.y};
  if(keyCode == UP_ARROW){
    newEntryCoords.y = Math.max(0,(newEntryCoords.y - 1)%img.height);
  }
  else if(keyCode == DOWN_ARROW){
    newEntryCoords.y = (newEntryCoords.y + 1)%img.height;
  }
  else if(keyCode == LEFT_ARROW){
    newEntryCoords.x = Math.max(0,(newEntryCoords.x - 1)%img.width);
  }
  else if(keyCode == RIGHT_ARROW){
    newEntryCoords.x = (newEntryCoords.x + 1)%img.width;
  }
  //if the cursor changed, update everything
  if(newEntryCoords.x != textEntryCursor.x || newEntryCoords.y != textEntryCursor.y){
    textEntryCursor.x = newEntryCoords.x;
    textEntryCursor.y = newEntryCoords.y;
    textEntryCursor.index = getStringIndexFromPixelCoords(textEntryCursor.x,textEntryCursor.y);
    document.body.style.setProperty("--byte-index-percent",textEntryCursor.index/(img.width*img.height));
    submitText();
  }
}

function mouseMoved(){
  if(mouseIsPressed)
    mousePressed();
}
function mousePressed(){
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

function stringToURL(dataString){
  //convert datastring to uint8 array
  const byteData = new Uint8Array(dataString.length);
  //add a byte for each char to the byte array
  for(let i = 0; i<dataString.length; i++){
    byteData[i] = dataString.charCodeAt(i);
  }
  //convert uint8 array to blob, and then to dataURL
  const blob = new Blob([byteData],{ type: 'image/'+MIMEType });
  return URL.createObjectURL(blob);
}

function recompileImage(dataString){
  const url = stringToURL(dataString);
  const newImg = document.createElement('img');
  //add an error event listener
  newImg.addEventListener("error", (event) => {
    setErrorMessage("error writing image: corrupted header or your confession was a little too honest :)");
  });
  
  newImg.src = url;
  newImg.onload = () => {
    clearError();
    document.getElementById('test').src = newImg.src;
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

async function preload(){
  img = await loadImage(imageAddress);
  MIMEType = 'jpeg';
}

function setup(){
  //get the image as a text string
  fetch(imageAddress)
    .then(result => result.arrayBuffer())
    .then(buffer => {      binaryDataString = bufferToBinaryString(buffer);
      setDataText();
      recompileImage(binaryDataString);
    });
  noCanvas();
  noLoop();
}

/*okay so the problem is that i 
want to save a jpeg and open it in a text editor and see the text i wrote into it
*/