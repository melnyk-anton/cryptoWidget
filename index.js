const canvas = document.getElementById("cryptoGraphWidget");
const gl = canvas.getContext("webgl2");
gl.viewport(0, 0, canvas.width, canvas.height);


// ======================= SHADERS =========================
const vertShaderCode = `#version 300 es
precision mediump float;

in vec2 a_position;
in vec2 a_uv;

uniform mat3 u_matrix;  // Add this
out vec2 v_texcoord;

void main() {
    // Apply matrix transform
    vec3 pos = u_matrix * vec3(a_position, 1.0);

    gl_Position = vec4(pos.xy, 0, 1);
    v_texcoord = a_uv;
}

`;

const fragShaderCode = `#version 300 es
precision mediump float;

uniform sampler2D u_msdf_font;
uniform float u_in_bias;
uniform float u_out_bias;
in vec2 v_texcoord;
out vec4 FragColor;
uniform vec4 bgColor;
uniform vec4 fgColor;
uniform float pxRange;

float screenPxRange() {
    vec2 unitRange = vec2(pxRange) / vec2(textureSize(u_msdf_font, 0));
    vec2 screenTexSize = vec2(1.0)/fwidth(v_texcoord);
    return max(0.5*dot(unitRange, screenTexSize), 1.0);
}

float median(float r, float g, float b) {
    return max(min(r, g), min(max(r, g), b));
}

void main() {
    vec3 sampl = texture(u_msdf_font, v_texcoord).rgb;
    float sigDist = median(sampl.r, sampl.g, sampl.b);
    float screenPxDistance = screenPxRange()*(sigDist - 0.5);
    float opacity = clamp(screenPxDistance + 0.5, 0.0, 1.0);
    FragColor = mix(bgColor, fgColor, opacity);
}
`;

const vertShaderCodeImg = `#version 300 es
precision mediump float;

in vec2 a_position;
in vec2 a_texcoord;

uniform float u_angle;
uniform vec2 u_center; // image center in clip space

out vec2 v_texcoord;

void main() {
    // Translate to origin
    vec2 pos = a_position - u_center;

    // Rotate
    float cosA = cos(u_angle);
    float sinA = sin(u_angle);
    vec2 rotated = vec2(
        pos.x * cosA - pos.y * sinA,
        pos.x * sinA + pos.y * cosA
    );

    // Translate back
    rotated += u_center;

    gl_Position = vec4(rotated, 0.0, 1.0);
    v_texcoord = a_texcoord;
}`;

const fragShaderCodeImg = `#version 300 es
precision mediump float;
in vec2 v_texcoord;
out vec4 outColor;

uniform sampler2D u_texture;
uniform vec4 u_tint; // RGBA color

void main() {
    vec4 texColor = texture(u_texture, v_texcoord);
    outColor = texColor * u_tint;
}

`;

// =================== SHADER SETUP ========================
function compileShader(type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error(gl.getShaderInfoLog(shader));
    }
    return shader;
}
function processProgram(vertexShader, fragmentShader){
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    return program;
}
let viewProjectionMat;
const vertexShader = compileShader(gl.VERTEX_SHADER, vertShaderCode);
const fragmentShader = compileShader(gl.FRAGMENT_SHADER, fragShaderCode);
const vertexShaderImg = compileShader(gl.VERTEX_SHADER, vertShaderCodeImg);
const fragmentShaderImg = compileShader(gl.FRAGMENT_SHADER, fragShaderCodeImg);

const program = processProgram(vertexShader, fragmentShader);
const program2 = processProgram(vertexShaderImg, fragmentShaderImg);



gl.linkProgram(program);

gl.linkProgram(program2);

gl.useProgram(program);

let camera = {
  x: 0,
  y: 0,
  rotation: 0,
  zoom: 1,
};



// Attribute and Uniform Locations
const a_position = gl.getAttribLocation(program, "a_position");
const a_uv = gl.getAttribLocation(program, "a_uv");
const u_resolution = gl.getUniformLocation(program, "u_resolution");
const u_msdf_font = gl.getUniformLocation(program, "u_msdf_font");
const u_in_bias = gl.getUniformLocation(program, "u_in_bias");
const u_out_bias = gl.getUniformLocation(program, "u_out_bias");
const bgColor = gl.getUniformLocation(program, "bgColor");
const fgColor = gl.getUniformLocation(program, "fgColor");
const pxRange = gl.getUniformLocation(program, "pxRange");
const u_matrix = gl.getUniformLocation(program, "u_matrix");
let MatType = Float32Array;


// Initial uniforms
gl.uniform2f(u_resolution, canvas.width, canvas.height);
gl.uniform1f(u_in_bias, 0.0);
gl.uniform1f(u_out_bias, 0.0);
gl.uniform1i(u_msdf_font, 0);
gl.uniform4f(bgColor, 0.0, 0.0, 0.0, 0.0);
gl.uniform4f(fgColor, 1.0, 1.0, 1.0, 1.0);
gl.uniform1f(pxRange, 6.0);
updateViewProjection();
gl.uniformMatrix3fv(u_matrix, false, multiply(viewProjectionMat, makeCameraMatrix()));

// Buffers
const positionBuffer = gl.createBuffer();
const uvBuffer = gl.createBuffer();
gl.enableVertexAttribArray(a_position);
gl.enableVertexAttribArray(a_uv);

// Enable blending for MSDF
gl.enable(gl.BLEND);
gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

// =================== LOAD FONT & IMAGE ====================
async function loadJSON(url) {
    const res = await fetch(url);
    return await res.json();
}

function loadImage(url) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = url;
    });
}
async function loadFontAndImage(jsonPath, imgPath) {
    const font = await loadJSON(jsonPath);
    const image = await loadImage(imgPath);

    return { font, image };
}
async function init() {
    
    const resources = await Promise.all([
        //loadFontAndImage("./fonts/ida-light-msdf/ida-light-msdf.json", "/fonts/ida-light-msdf/ida-light.png"),
        //loadFontAndImage("./fonts/arial-msdf/arial-msdf.json", "/fonts/arial-msdf/arial.png"),
        loadFontAndImage("./fonts/atlas-128-6/atlas-128-6.json", "./fonts/atlas-128-6/atlas-128-6.png"),
        loadImage('/src/up_arrow.png'),
        loadImage('/src/binance_logo.png')
    ]);
    const texture = gl.createTexture();
    
    
        
    render(resources, texture);
    
}


  function identity(dst) {
    dst = dst || new MatType(9);
    dst[0] = 1;
    dst[1] = 0;
    dst[2] = 0;
    dst[3] = 0;
    dst[4] = 1;
    dst[5] = 0;
    dst[6] = 0;
    dst[7] = 0;
    dst[8] = 1;

    return dst;
  }

  function translation(tx, ty, dst) {
    dst = dst || new MatType(9);

    dst[0] = 1;
    dst[1] = 0;
    dst[2] = 0;
    dst[3] = 0;
    dst[4] = 1;
    dst[5] = 0;
    dst[6] = tx;
    dst[7] = ty;
    dst[8] = 1;

    return dst;
  }


  function translate(m, tx, ty, dst) {    
    return multiply(m, translation(tx, ty), dst);
  }

  function rotation(angleInRadians, dst) {
    var c = Math.cos(angleInRadians);
    var s = Math.sin(angleInRadians);

    dst = dst || new MatType(9);

    dst[0] = c;
    dst[1] = -s;
    dst[2] = 0;
    dst[3] = s;
    dst[4] = c;
    dst[5] = 0;
    dst[6] = 0;
    dst[7] = 0;
    dst[8] = 1;

    return dst;
  }

  function rotate(m, angleInRadians, dst) {
    return multiply(m, rotation(angleInRadians), dst);
  }

  function scaling(sx, sy, dst) {
    dst = dst || new MatType(9);

    dst[0] = sx;
    dst[1] = 0;
    dst[2] = 0;
    dst[3] = 0;
    dst[4] = sy;
    dst[5] = 0;
    dst[6] = 0;
    dst[7] = 0;
    dst[8] = 1;

    return dst;
  }


  function scale(m, sx, sy, dst) {
    return multiply(m, scaling(sx, sy), dst);
  }

function inverse(m, dst) {
    dst = dst || new MatType(9);

    const m00 = m[0 * 3 + 0];
    const m01 = m[0 * 3 + 1];
    const m02 = m[0 * 3 + 2];
    const m10 = m[1 * 3 + 0];
    const m11 = m[1 * 3 + 1];
    const m12 = m[1 * 3 + 2];
    const m20 = m[2 * 3 + 0];
    const m21 = m[2 * 3 + 1];
    const m22 = m[2 * 3 + 2];

    const b01 =  m22 * m11 - m12 * m21;
    const b11 = -m22 * m10 + m12 * m20;
    const b21 =  m21 * m10 - m11 * m20;

    const det = m00 * b01 + m01 * b11 + m02 * b21;
    const invDet = 1.0 / det;

    dst[0] = b01 * invDet;
    dst[1] = (-m22 * m01 + m02 * m21) * invDet;
    dst[2] = ( m12 * m01 - m02 * m11) * invDet;
    dst[3] = b11 * invDet;
    dst[4] = ( m22 * m00 - m02 * m20) * invDet;
    dst[5] = (-m12 * m00 + m02 * m10) * invDet;
    dst[6] = b21 * invDet;
    dst[7] = (-m21 * m00 + m01 * m20) * invDet;
    dst[8] = ( m11 * m00 - m01 * m10) * invDet;

    return dst;
  }

  
// Transform a point [x, y] using matrix m
 function transformPoint(m, v) {
    var v0 = v[0];
    var v1 = v[1];
    var d = v0 * m[0 * 3 + 2] + v1 * m[1 * 3 + 2] + m[2 * 3 + 2];
    return [
      (v0 * m[0 * 3 + 0] + v1 * m[1 * 3 + 0] + m[2 * 3 + 0]) / d,
      (v0 * m[0 * 3 + 1] + v1 * m[1 * 3 + 1] + m[2 * 3 + 1]) / d,
    ];
  }

function projection(width, height, dst) {
    dst = dst || new MatType(9);
    // Note: This matrix flips the Y axis so 0 is at the top.
    
    dst[0] = 2 / width;
    dst[1] = 0;
    dst[2] = 0;
    dst[3] = 0;
    dst[4] = -2 / height;
    dst[5] = 0;
    dst[6] = -1;
    dst[7] = 1;
    dst[8] = 1;

    return dst;
  }
function multiply(a, b, dst) {
    dst = dst || new MatType(9);
    var a00 = a[0 * 3 + 0];
    var a01 = a[0 * 3 + 1];
    var a02 = a[0 * 3 + 2];
    var a10 = a[1 * 3 + 0];
    var a11 = a[1 * 3 + 1];
    var a12 = a[1 * 3 + 2];
    var a20 = a[2 * 3 + 0];
    var a21 = a[2 * 3 + 1];
    var a22 = a[2 * 3 + 2];
    var b00 = b[0 * 3 + 0];
    var b01 = b[0 * 3 + 1];
    var b02 = b[0 * 3 + 2];
    var b10 = b[1 * 3 + 0];
    var b11 = b[1 * 3 + 1];
    var b12 = b[1 * 3 + 2];
    var b20 = b[2 * 3 + 0];
    var b21 = b[2 * 3 + 1];
    var b22 = b[2 * 3 + 2];

    dst[0] = b00 * a00 + b01 * a10 + b02 * a20;
    dst[1] = b00 * a01 + b01 * a11 + b02 * a21;
    dst[2] = b00 * a02 + b01 * a12 + b02 * a22;
    dst[3] = b10 * a00 + b11 * a10 + b12 * a20;
    dst[4] = b10 * a01 + b11 * a11 + b12 * a21;
    dst[5] = b10 * a02 + b11 * a12 + b12 * a22;
    dst[6] = b20 * a00 + b21 * a10 + b22 * a20;
    dst[7] = b20 * a01 + b21 * a11 + b22 * a21;
    dst[8] = b20 * a02 + b21 * a12 + b22 * a22;

    return dst;
  }


function makeCameraMatrix() {
    const zoomScale = 1 / camera.zoom;
  let cameraMat =identity();
  cameraMat = translate(cameraMat, camera.x, camera.y);
    cameraMat = rotate(cameraMat, camera.rotation);
    cameraMat = scale(cameraMat, zoomScale, zoomScale);

  //console.log(camera.x, camera.y);
  
  return cameraMat;
}




function updateViewProjection() {
  const projectionMat = projection(gl.canvas.width, gl.canvas.height);
  const cameraMat = makeCameraMatrix();
    const viewMat = inverse(cameraMat);
    viewProjectionMat = multiply(projectionMat, viewMat); // viewMat = inverse(cameraMat)

}

function render(resources, texture){
     gl.clearColor(0.06, 0.07, 0.09, 1); // dark background
    gl.clear(gl.COLOR_BUFFER_BIT);

    updateViewProjection();

    gl.useProgram(program);
    gl.uniformMatrix3fv(u_matrix, false, viewProjectionMat);
    drawTextWithFont(resources[0].font, resources[0].image, "$ 528.80", 100, 100, 100, texture);
    drawTextWithFont(resources[0].font, resources[0].image, "binance / BNBUSDC", 45, 150, 253, texture);

    //gl.useProgram(program2);
    //drawImage(resources[2], 475, 150, 52, 32);
    //drawImage(resources[3], 150, 220, 52, 32);
    

   

   //requestAnimationFrame(() => render(resources, texture));
   //render(resources, texture);

}

function getClipSpaceMousePosition(e) {
  const rect = canvas.getBoundingClientRect();
  const cssX = e.clientX - rect.left;
  const cssY = e.clientY - rect.top;
  
  const normalizedX = cssX / canvas.clientWidth;
  const normalizedY = cssY / canvas.clientHeight;

  const clipX = normalizedX *  2 - 1;
  const clipY = normalizedY * -2 + 1;
  
  return [clipX, clipY];
}

canvas.addEventListener('wheel', (e) => {
  e.preventDefault();

  const [clipX, clipY] = getClipSpaceMousePosition(e);
  //console.log(clipX, clipY);

  // World position before zoom
  const worldBefore = transformPoint(inverse(viewProjectionMat), [clipX, clipY]);
  

  // Change zoom
  const newZoom = camera.zoom * Math.pow(2, e.deltaY * -0.01);
  camera.zoom = Math.max(0.02, Math.min(100, newZoom));

  updateViewProjection();

  // World position after zoom
  const worldAfter = transformPoint(inverse(viewProjectionMat), [clipX, clipY]);

    console.log(worldBefore[0], worldAfter[0]);
    camera.x += (worldBefore[0]-worldAfter[0]);
  camera.y += (worldBefore[1]-worldAfter[1]);

    //console.log(worldAfter);
  

  updateViewProjection();

  init();
});


async function drawTextWithFont(font, image, text, scale, x, y, texture) {

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

    renderText(text, font, scale, x, y);

    return 0;
}

// =================== RENDER TEXT ==========================
function renderText(text, fontData, fontSize, x, y) {
    const positions = [];
    const uvs = [];

    const atlasW = fontData.atlas.width;
    const atlasH = fontData.atlas.height;

    const glyphs = fontData.variants[0].glyphs;

    let cursorX = x;
    let cursorY = y; 

    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        const code = ch.charCodeAt(0);

        const glyph = glyphs.find(g => g.unicode === code);
        if (!glyph) continue;

        if (glyph.planeBounds && glyph.atlasBounds) {
            
            const pb = glyph.planeBounds;
            const ab = glyph.atlasBounds;

            const x0 = cursorX + pb.left * fontSize;
            const y0 = cursorY + pb.bottom * fontSize;
            const x1 = cursorX + pb.right * fontSize;
            const y1 = cursorY + pb.top * fontSize;
            console.log(ch, glyph,x0,x1,y0,y1);

            positions.push(
                x0, y0,
                x1, y0,
                x0, y1,
                x0, y1,
                x1, y0,
                x1, y1
            );

            const u0 = ab.left / atlasW;
            const v0 = 1.0 - (ab.top / atlasH);
            const u1 = ab.right / atlasW;
            const v1 = 1.0 - (ab.bottom / atlasH);




            uvs.push(
                u0, v0,
                u1, v0,
                u0, v1,
                u0, v1,
                u1, v0,
                u1, v1
            );
        }
        cursorX += (glyph.advance) * fontSize;
    }

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(positions), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, uvBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(uvs), gl.DYNAMIC_DRAW);
    gl.vertexAttribPointer(a_uv, 2, gl.FLOAT, false, 0, 0);

    gl.drawArrays(gl.TRIANGLES, 0, positions.length / 2);

}




init();






async function drawImage(image, x, y, width, height){
    // Convert pixels to clip space
    const x0 = (x / canvas.width) * 2 - 1;
    const x1 = ((x + width) / canvas.width) * 2 - 1;
    const y0 = ((canvas.height - y - height) / canvas.height) * 2 - 1; // bottom
    const y1 = ((canvas.height - y) / canvas.height) * 2 - 1; // top

    const positions = new Float32Array([
        x0, y0,
        x1, y0,
        x0, y1,
        x0, y1,
        x1, y0,
        x1, y1
    ]);

    const texcoords = new Float32Array([
        0, 0,  1, 0,  0, 1,
        0, 1,  1, 0,  1, 1
    ]);

    // Position buffer
    const positionBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, positions, gl.DYNAMIC_DRAW);
    const a_position = gl.getAttribLocation(program2, 'a_position');
    gl.enableVertexAttribArray(a_position);
    gl.vertexAttribPointer(a_position, 2, gl.FLOAT, false, 0, 0);

    // Texcoord buffer
    const texcoordBuffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, texcoordBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, texcoords, gl.STATIC_DRAW);
    const a_texcoord = gl.getAttribLocation(program2, 'a_texcoord');
    gl.enableVertexAttribArray(a_texcoord);
    gl.vertexAttribPointer(a_texcoord, 2, gl.FLOAT, false, 0, 0);

    // Create texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);


    // Set rotation in radians
    const angle = Math.PI / 2; // 45 degrees
    const u_angle = gl.getUniformLocation(program2, "u_angle");
    gl.uniform1f(u_angle, angle);

    // Compute image center in clip space
    const centerX = ((x + width / 2) / canvas.width) * 2 - 1;
    const centerY = ((canvas.height - (y + height / 2)) / canvas.height) * 2 - 1;

    const u_center = gl.getUniformLocation(program2, "u_center");
    gl.uniform2f(u_center, centerX, centerY);

    const u_tint = gl.getUniformLocation(program2, "u_tint");

    // Example: red tint
    gl.uniform4f(u_tint, 10.0, 0.0, 0.0, 1.0); // RGBA


    // Draw
    gl.drawArrays(gl.TRIANGLES, 0, 6);

}
//# sourceMappingURL=/sm/f4df2bd9dc6111d5e715f209c3b1eb6ebf545563d715d85fc0ee22fe9aff26cf.map