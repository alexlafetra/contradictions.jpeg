//jpeg confession algorithm

//heic-to library
// https://github.com/hoppergee/heic-to
let heicTo = undefined, isHeic = undefined;
import("./heic-to.min.js").then(m => {
  heicTo = m.heicTo;
  isHeic = m.isHeic;
});

const Confession = () =>{
  return ({
    maxChunkSize : 100,
    binaryData:"",
    entryIndex : 0,
    scrollbarPosition : 0,
    currentlyConfessedDiv : null,
    JPEGCompressionQuality : 0.5,
    originalFile : null,
    jpegData: null,
  });
}

const confession = Confession();

const defaultImageAddress = "./images/clouds.jpeg";
const imageSizeLimit = 350000; //300kB file size limit
const maxDim = 800;
const headerZone = 0.1;
// const imageSizeLimit = 350000000; //300kB file size limit

function buildTextPreviewDivs(){
  const children = [];
  for(let i = 0; i<confession.binaryData.length; i+=confession.maxChunkSize){
    let text = "";
    //if this is the last chunk, grab till the end of the text
    if((i + confession.maxChunkSize) >= confession.binaryData.length){
      text = confession.binaryData.slice(i);
    }
    else{
      text = confession.binaryData.slice(i,i+confession.maxChunkSize);
    }
    let newElement = document.createElement('div');
    if(i<confession.jpegData.headerSize){
      newElement.className = "binary_data_chunk header_data";
    }
    else{
      newElement.className = "binary_data_chunk";
    }
    newElement.innerText = text;
    children.push(newElement);
  }
  const container = document.getElementById('binary_data_container');
  container.replaceChildren(...children);
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
  },'image/jpeg',confession.JPEGCompressionQuality);
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
  reader_url.addEventListener("load",() => {
    document.getElementById('original_image').src = reader_url.result;
  });
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

function handleFileInput(event){
  const files = event.target.files;
  //if there are files, read em!
  if (files && files.length) {
    loadFile(files[0]);
  }
}

function loadFile(file){
  confession.originalFile = file;
  //if the file isn't a jpeg/if it's too big, re-encode it as a small jpeg
  if(file.type != 'image/jpeg' || file.size > imageSizeLimit){
    if(file.type != 'image/jpeg')
      setErrorMessage('converting image to JPEG...');
    else
      setErrorMessage('resizing image...');
    //loading animation
    document.getElementById('original_image').src = './images/LAB.webp';
    transcodeFileToJPEG(file);
  }
  //if the image is a small jpg, load it normally
  else{
    loadImageIntoDom(file);
  }
}

function saveImageFile(){
  const htmlTextInputElement = document.getElementById("text_input_area");

  //get object URL
  const objectURL = stringToURL(confession.binaryData.slice(0,confession.entryIndex)+htmlTextInputElement.value+confession.binaryData.slice(confession.entryIndex));

  //trigger a download
  const link = document.createElement('a');
  link.href = objectURL;
  link.download = 'confession.jpeg';  // desired filename
  link.click();
  URL.revokeObjectURL(objectURL);
}

function saveTextFile(){
  const htmlTextInputElement = document.getElementById("text_input_area");
  const text = confession.binaryData.slice(0,confession.entryIndex)+htmlTextInputElement.value+confession.binaryData.slice(confession.entryIndex);
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = "confession.txt"; // Sets the default file name
  link.click();
  URL.revokeObjectURL(url);
}

function commitTextAndStartNewEntry(){
  const htmlTextInputElement = document.getElementById("text_input_area");
  const newString = confession.binaryData.slice(0,confession.entryIndex)+htmlTextInputElement.value+confession.binaryData.slice(confession.entryIndex);
  htmlTextInputElement.value = "";

  //convert datastring to uint8 array
  const byteData = new Uint8Array(newString.length);
  //add a byte for each char to the byte array
  for(let i = 0; i<newString.length; i++){
    byteData[i] = newString.charCodeAt(i);
  }
  confession.binaryData = bufferToBinaryString(byteData);
  buildTextPreviewDivs();
}

function getBytePositionFromPercent(ratio){
  let newIndex;
  //if ur in a predefined 'header zone', then scale the position relative to the header
  if(ratio < headerZone){
    newIndex = ratio * 1/headerZone * confession.jpegData.headerSize;
  }
  else{
    //when ratio == 1, this needs to be binaryDataString.length
    //when ratio == headerZone, this needs to be confession.jpegData.headerSize
    //so with a simple map_range, it'd be:
    // Math.map(ratio,headerZone,1.0,confession.jpegData.headerSize,binaryDataString.length);
    
    //// Source - https://stackoverflow.com/a/5732390
    // Posted by Alok Singhal
    // Retrieved 2026-02-12, License - CC BY-SA 3.0
    // output = output_start + ((output_end - output_start) / (input_end - input_start)) * (input - input_start)
    newIndex = confession.jpegData.headerSize + ((confession.binaryData.length - confession.jpegData.headerSize) / (1.0 - headerZone)) * (ratio - headerZone);

  } 
  setNewIndex(newIndex);
}

function handleScroll(event){
  //increment index
  const newIndex  = Math.min(Math.max(confession.entryIndex + (event.deltaY),0),confession.binaryData.length);
  setNewIndex(newIndex);
}

function setNewIndex(index){
  confession.entryIndex = Math.max(Math.min(Math.trunc(index),confession.binaryData.length),0);
  const ratio = confession.entryIndex<confession.jpegData.headerSize?
    (confession.entryIndex/confession.jpegData.headerSize * headerZone):
    (headerZone + ((1.0 - headerZone) / (confession.binaryData.length - confession.jpegData.headerSize) * (index - confession.jpegData.headerSize)));
  document.body.style.setProperty("--scrollbar-percent",ratio);
  document.body.style.setProperty("--byte-scrollbar-color",confession.entryIndex<confession.jpegData.headerSize?'rgb(0, 255, 174)':'rgb(255,0,100)');

  document.getElementById('byte_display').innerText = `byte ${confession.entryIndex}`;
  insertText(confession.entryIndex);
  recompileImage();
  const textContainer = document.getElementById('binary_data_container');
  textContainer.scrollTop = Math.max(textContainer.scrollHeight * confession.entryIndex/confession.binaryData.length -textContainer.clientHeight/2,0);
}

function updateSliderVisual(val){
  const element = document.getElementById('slider_display');
  const bounds = element.getBoundingClientRect();
  const charWidth = bounds.width/50;
  const amount =  (parseFloat(val))*bounds.width/charWidth;
  let str = "[";
  for(let i = 1; i<49; i++){
    if(i < amount){
      str += "+";
      if(i+1 >= amount){
        str+="]";
        i++;
      }
    }
    else{
      str+="-";
    }
  }
  str+="]";
  element.innerText = str;
}

function insertText(index){
  const whichDivIndex = Math.trunc(index / confession.maxChunkSize);

  // clear out old display
  const oldDiv = document.getElementById('active_data_chunk');
  if(oldDiv){
    oldDiv.id = "";
    const parent = document.getElementById('binary_data_container');
    parent.removeChild(document.getElementById('inserted_data_chunk'));
  }
  const currentDiv = document.getElementsByClassName('binary_data_chunk')[whichDivIndex];
  if(currentDiv){
    //hide the current div
    currentDiv.id = 'active_data_chunk';

    //create a container for the new stuff
    const container = document.createElement('div');
    container.id = "inserted_data_chunk";
    const inserted = document.createElement('span');
    inserted.id = "inserted_data";
    const htmlTextInputElement = document.getElementById("text_input_area");
    inserted.innerText = htmlTextInputElement.value == ""?"[insert confession here]":htmlTextInputElement.value;
    let pre = "";
    let post = "";

    //if there's text in this chunk that comes before the insertion point
    if(index%confession.maxChunkSize){
      pre = confession.binaryData.slice(whichDivIndex*confession.maxChunkSize,index);
    }
    //if there's text that comes after the insertion point
    if((index%confession.maxChunkSize) < (confession.maxChunkSize - 1)){
      post = confession.binaryData.slice(index,confession.maxChunkSize*(whichDivIndex+1));
    }

    container.appendChild(document.createTextNode(pre));
    container.appendChild(inserted);
    container.appendChild(document.createTextNode(post));
    currentDiv.insertAdjacentElement('beforebegin',container);
  }
}

function handleDrag(event){
  if(event.buttons || (event.touches && event.touches.length)){
    //total width of the scrollbar
    const targetHeight = event.srcElement.clientHeight;
    //location of click within scrollbar
    const clickPos = event.touches?event.touches[0].clientY:event.offsetY;
    getBytePositionFromPercent(clickPos/targetHeight);
  }
}
function moveByteIndexUp(){
  setNewIndex(confession.entryIndex-1);
}
function moveByteIndexDown(){
  setNewIndex(confession.entryIndex+1);
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
  const url = stringToURL(confession.binaryData.slice(0,confession.entryIndex)+htmlTextInputElement.value+confession.binaryData.slice(confession.entryIndex));
  const newImg = document.createElement('img');
  //add an error event listener
  newImg.addEventListener("error", (event) => {
    setErrorMessage("error writing image :( try another byte location");
    document.getElementById('processed_image').src = null;
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
  confession.jpegData = {...parseJpegHeader(bytes)};
  const len = bytes.byteLength;
  for(let i = 0; i<len; i++){
    binaryString += String.fromCharCode(bytes[i]);
  }
  return binaryString;
}

function loadNewImage(buffer){
  confession.binaryData = bufferToBinaryString(buffer);
  // document.getElementById('original_text').innerText = confession.binaryData;
  buildTextPreviewDivs();
  recompileImage();
}

function setup(){
  //load in in the initial image
  fetch(defaultImageAddress)
    .then(result => {
      return result.arrayBuffer();
    })
    .then(buffer => {
      confession.originalFile = new File([buffer], "default.jpeg", { type: "image/jpeg" || buffer.type });
      loadNewImage(buffer);
      updateSliderVisual(confession.JPEGCompressionQuality);
    });
  //set the original image
  document.getElementById('original_image').src = defaultImageAddress;
}

window.onload = setup;

function setErrorMessage(message){
  document.getElementById("error_text_container").innerText = message;
}

function clearError(){
  document.getElementById("error_text_container").innerText = '';
}

function openFileSelector(){
  document.getElementById("file_selector").click();
}

function setCompressionQuality(val){
  confession.JPEGCompressionQuality = val;
  loadFile(confession.originalFile);
  recompileImage();
}