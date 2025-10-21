const imageAddress = "data/clouds.jpeg";
const imageSizeLimit = 300000; //300kB file size limit
let MIMEType = "";
let img;
let textEntryCursor = {
  index : 40000,
  x:0,
  y:0
};

let binaryDataString = "";


function setErrorMessage(message){
  const errorMessageContainer = document.getElementById("error_container");
  errorMessageContainer.style.display = "block";
  errorMessageContainer.innerHTML = message;
}

function clearError(){
  document.getElementById("error_container").style.display = "none";
}

function openFileSelector(){
  document.getElementById("file_selector").click();
}

async function loadNewImage(event){

  const files = event.target.files;
  MIMEType = files[0].type;
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
      img = loadImage(reader_image.result,()=>{
        resizeCanvas(img.width,img.height);
        rerender();
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
  img.save(document.getElementById("secret_text").innerHTML);
}


function rerender(){
  image(img,-img.width/2,-img.height/2,img.width,img.height);
  //green ellipse, just to see if it worked (debug)
  fill(255,0,100,200);
  noStroke();
  rect(textEntryCursor.x-width/2,textEntryCursor.y-height/2,8,16)
}

//function that taxes pixel coords (x,y) and converts them to approximate string index coords
function getStringIndexFromPixelCoords(x,y){
  if(MIMEType == 'image/jpeg'){
    //convert coords to pixel block coords
    const blockWidth = Math.ceil(img.width/8);
    const blockHeight = Math.ceil(img.height/8);
    const totalBlocks = blockWidth * blockHeight;

    //Get the block coords from the pixel coords
    const blockX = Math.floor(x / 8);
    const blockY = Math.floor(y / 8);
    const blockIndex = blockY * blockWidth + blockX;

    const bytesPerBlock = binaryDataString.length/totalBlocks;
    const approxByteIndex = Math.floor(blockIndex*bytesPerBlock);

    return approxByteIndex;
  }
}

function setSecretText(){
  const secretTextElement = document.getElementById("secret_text");
  secretTextElement.innerHTML = document.getElementById("secret_input").value;
  secretTextElement.scrollIntoView({
    behavior:'instant',//jump instantly
    block: 'center'//center it vertically
  });
}

function setDataText(){
  //set the two chunks of text that won't change
  document.getElementById("text_start").innerHTML = binaryDataString.slice(0,textEntryCursor.index);
  document.getElementById("text_end").innerHTML = binaryDataString.slice(textEntryCursor.index);
}

//called by the onclick event of the "enter" button
function enterText(){
  const htmlTextInputElement = document.getElementById("secret_input");
  recompileImage(binaryDataString.slice(0,textEntryCursor.index)+htmlTextInputElement.value+binaryDataString.slice(textEntryCursor.index));
  setSecretText();
}

function mouseClicked(){
  if(mouseX<width && mouseY < height && mouseX > 0 && mouseY >0){
    console.log("x:",mouseX);
    console.log("y:",mouseY);
    textEntryCursor = {
      x:mouseX,
      y:mouseY,
      index : getStringIndexFromPixelCoords(mouseX,mouseY)
    };
    enterText();
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
  const blob = new Blob([byteData],{ type: MIMEType });
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
  const len = bytes.byteLength;
  for(let i = 0; i<len; i++){
    binaryString += String.fromCharCode(bytes[i]);
  }
  return binaryString;
}

async function preload(){
  img = await loadImage(imageAddress);
  MIMEType = 'image/jpeg';
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
  image(img,-img.width/2,-img.height/2,img.width,img.height);
  noLoop();
}
