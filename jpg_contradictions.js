//jpeg confession algorithm

//heic-to library
// https://github.com/hoppergee/heic-to
let heicTo = undefined, isHeic = undefined;
import("./heic-to.min.js").then(m => {
  heicTo = m.heicTo;
  isHeic = m.isHeic;
});

const defaultImageAddress = "./images/clouds.jpeg";
const imageSizeLimit = 350000; //300kB file size limit
const JPEGConversionQuality = 1.0;
const maxDim = 800;
// const imageSizeLimit = 350000000; //300kB file size limit
let headerSize = 0;
let textEntryCursor = {
  index : 0,
  x:0,
  y:0
};
let binaryDataString = "";

function toggleAbout(){
  const aboutPage = document.getElementById('about_page');
  if(aboutPage.style.visibility == 'hidden'){
    aboutPage.style.visibility = 'visible';
  }
  else{
    aboutPage.style.visibility = 'hidden'
  }
}

function setErrorMessage(message){
  document.getElementById("error_text_container").innerText = message;
}

function clearError(){
  document.getElementById("error_text_container").innerText = '';
}

function openFileSelector(){
  document.getElementById("file_selector").click();
}

function convertImageToBuffer(bitmap){
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");

  const aR = bitmap.width/bitmap.height;
  let w = bitmap.width,h = bitmap.height;
  if(w > h && w > maxDim){
    w = maxDim;
    h = w / aR;
  }
  else if(h > w && h > maxDim){
    h = maxDim;
    w = h * aR;
  }
  else if(h == w && h > maxDim){
    h = maxDim;
    w = maxDim;
  }
  canvas.width  = w;
  canvas.height = h
  ctx.drawImage(bitmap, 0, 0, w, h);

  //convert canvas to blob, then array buffer, and load it!
  canvas.toBlob((blob) => {
    loadImageIntoDom(blob);
  },'image/jpeg',JPEGConversionQuality);
}

function loadImageIntoDom(imgData){
  //this seems inefficient.. but i'm reading in
  //the image once as an objectURL to set the original image src
  //and once as an arraybuffer to compile it from text
  const reader_data = new FileReader();
  reader_data.addEventListener("load",() => {
    loadNewImage(reader_data.result);
  });
  reader_data.readAsArrayBuffer(imgData);

  //read in the file
  const reader_url = new FileReader();
  reader_url.addEventListener("load",() => {document.getElementById('original_image').src = reader_url.result;});
  reader_url.readAsDataURL(imgData);
}

//converts heic/png to jpeg, and resizes all files (even if jpegs) to be within a certain size
async function transcodeFileToJPEG(file){
  
  //if these functions haven't loaded yet
  if(!isHeic || !heicTo)
    return;

  //use heic-to library to handle .heic files from iphones
  if(await isHeic(file)){
    // Convert to JPEG
    // blob = await heicTo({
    //   blob: file,
    //   type: "image/jpeg",
    //   quality: 0.8
    // })
    // Convert to PNG
    blob = await heicTo({
      blob: file,
      type: "image/png"
    });

    //draw image to canvas (resized), then convert to jpg
    createImageBitmap(blob).then(bitmap => {
      convertImageToBuffer(bitmap);
    });
  }
  else{
    //convert file to dataURL, then create image with that URL, then feed it to the image converter
    const img = new Image();
    img.onload = () => {
      convertImageToBuffer(img);
    }
    const reader_url = new FileReader();
    reader_url.addEventListener("load",() => {
      img.src = reader_url.result;
    });
    reader_url.readAsDataURL(file);
  }
}

function loadFile(event){
  const files = event.target.files;
  //if there are files, read em!
  if (files && files.length) {
    //if the file isn't a jpeg/if it's too big, rencode it as a small jpeg
    if(files[0].type != 'image/jpeg' || files[0].size > imageSizeLimit){
      if(files[0].type != 'image/jpeg')
        setErrorMessage('converting image to JPEG...');
      else
        setErrorMessage('resizing image...');
      //loading animation
      document.getElementById('original_image').src = './images/LAB.webp';
      transcodeFileToJPEG(files[0]);
    }
    //if the image is a small jpg, load it normally
    else{
      loadImageIntoDom(files[0]);
    }
  }
}

function saveImage(){
  const htmlTextInputElement = document.getElementById("text_input_area");

  //get object URL
  const objectURL = stringToURL(binaryDataString.slice(0,textEntryCursor.index)+htmlTextInputElement.value+binaryDataString.slice(textEntryCursor.index));

  //trigger a download
  const link = document.createElement('a');
  link.href = objectURL;
  link.download = 'confession.jpeg';  // desired filename
  link.click();
}

function commitTextAndStartNewEntry(){
  const htmlTextInputElement = document.getElementById("text_input_area");
  const newString = binaryDataString.slice(0,textEntryCursor.index)+htmlTextInputElement.value+binaryDataString.slice(textEntryCursor.index);
  htmlTextInputElement.value = "";

  //convert datastring to uint8 array
  const byteData = new Uint8Array(newString.length);
  //add a byte for each char to the byte array
  for(let i = 0; i<newString.length; i++){
    byteData[i] = newString.charCodeAt(i);
  }
  binaryDataString = bufferToBinaryString(byteData);
  document.getElementById('original_text').innerText = binaryDataString;
}

function sliderClickHandler(event){
  //total width of the scrollbar
  const targetHeight = event.srcElement.clientHeight;
  //location of click within scrollbar
  const clickPos = event.offsetY;
  const newIndex = Math.trunc((binaryDataString.length)*clickPos/targetHeight);
  setNewIndex(newIndex);  setNewIndex(newIndex);
}
function sliderUnclickHandler(){
}

function handleClickOnOutputImage(event){
  event.preventDefault();
  event.stopPropagation();
  const coords = {x:event.offsetX,y:event.offsetY};
  const img = document.getElementById('processed_image');
  const index = coords.x + coords.y * img.width;
  setNewIndex(index);
}
function handleDragOnOutputImage(event){
  event.preventDefault();
  event.stopPropagation();
  if(event.buttons){
    handleClickOnOutputImage(event);
  }
}
function handleScroll(event){
  //increment index
  const newIndex  = Math.min(Math.max(textEntryCursor.index + (event.deltaY),0),binaryDataString.length);
  setNewIndex(newIndex);
}

function handleDrag(event){
  if(event.buttons || (event.touches && event.touches.length)){
    //total width of the scrollbar
    const targetHeight = event.srcElement.clientHeight;
    //location of click within scrollbar
    const clickPos = event.touches?event.touches[0].clientY:event.offsetY;
    const newIndex = Math.trunc((binaryDataString.length)*clickPos/targetHeight);
    setNewIndex(newIndex);
  }
}
function moveByteIndexUp(){
  setNewIndex(textEntryCursor.index-1);
}
function moveByteIndexDown(){
  setNewIndex(textEntryCursor.index+1);
}
function setNewIndex(index){
  const img = document.getElementById('processed_image');
  textEntryCursor.index = Math.max(Math.min(Math.trunc(index),binaryDataString.length),0);
  textEntryCursor.x = textEntryCursor.index%img.width;
  textEntryCursor.y = Math.trunc(textEntryCursor.index/img.width);
  document.body.style.setProperty("--byte-index-percent",textEntryCursor.index/binaryDataString.length);

  document.getElementById('byte_display').innerText = `<-- scroll --> byte ${textEntryCursor.index}`;

  recompileImage();
  const textContainer = document.getElementById('binary_text_container');
  textContainer.scrollTop = Math.max(textContainer.scrollHeight * textEntryCursor.index/binaryDataString.length -textContainer.clientHeight/2,0);
}

function stringToURL(dataString){
  //convert datastring to uint8 array
  const byteData = new Uint8Array(dataString.length);
  //add a byte for each char to the byte array
  for(let i = 0; i<dataString.length; i++){
    byteData[i] = dataString.charCodeAt(i);
  }
  //convert uint8 array to blob, and then to dataURL
  const blob = new Blob([byteData],{ type: 'image/jpeg'});
  return URL.createObjectURL(blob);
}

function recompileImage(){
  const htmlTextInputElement = document.getElementById("text_input_area");
  const url = stringToURL(binaryDataString.slice(0,textEntryCursor.index)+htmlTextInputElement.value+binaryDataString.slice(textEntryCursor.index));
  const newImg = document.createElement('img');
  //add an error event listener
  newImg.addEventListener("error", (event) => {
    setErrorMessage("error writing image :( try another byte location");
    document.getElementById('processed_image').src = './images/xp_error.png'
  });
  
  newImg.src = url;
  newImg.onload = () => {
    clearError();
    document.getElementById('processed_image').src = newImg.src;
    URL.revokeObjectURL(url);
  }
}

function bufferToBinaryString(buffer){
  let binaryString = '';
  const bytes = new Uint8Array(buffer);
  const header = parseJpegHeader(bytes);
  document.documentElement.style.setProperty( "--jpeg-header-percent",header.headerSize/bytes.length);
  const len = bytes.byteLength;
  for(let i = 0; i<len; i++){
    binaryString += String.fromCharCode(bytes[i]);
  }
  return binaryString;
}

function loadNewImage(buffer){
  binaryDataString = bufferToBinaryString(buffer);
  document.getElementById('original_text').innerText = binaryDataString;
  recompileImage();
}

function setup(){
  //load in in the initial image
  fetch(defaultImageAddress)
    .then(result => result.arrayBuffer())
    .then(buffer => {
      loadNewImage(buffer);
    });
  //set the original image
  document.getElementById('original_image').src = defaultImageAddress;
}

window.onload = setup;
/*okay so the problem is that i 
want to save a jpeg and open it in a text editor and see the text i wrote into it
*/