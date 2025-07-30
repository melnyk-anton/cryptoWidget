const canvas = document.getElementById("cryptoGraphWidget");
const gl = canvas.getContext("webgl");

gl.clearColor(0.06, 0.07, 0.09, 1);

const vertexShaderSource = `
    attribute vec2 a_position;
    uniform vec2 u_resolution;
    void main() {
        vec2 zeroToOne = a_position / u_resolution;
        vec2 zeroToTwo = zeroToOne * 2.0;
        vec2 clipSpace = zeroToTwo - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
    }
`;
const fragmentShaderSource = `
    precision mediump float;
    uniform vec4 u_color;
    void main() {
        gl_FragColor = u_color;
    }
`;

// New gradient fragment shader
const gradientFragmentSource = `
    precision mediump float;
    uniform vec2 u_resolution;
    uniform float u_topY;
    uniform float u_bottomY;
    uniform vec4 u_topColor;
    uniform vec4 u_bottomColor;
    
    void main() {
        float normalizedY = (gl_FragCoord.y - u_bottomY) / (u_topY - u_bottomY);
        normalizedY = clamp(normalizedY, 0.0, 1.0);
        gl_FragColor = mix(u_bottomColor, u_topColor, normalizedY);
    }
`;

const texturedVertexSrc = `
    attribute vec2 a_position;
    attribute vec2 a_texCoord;
    uniform vec2 u_resolution;
    uniform vec2 u_translation;
    uniform vec2 u_size;
    uniform float u_rotation;
    varying vec2 v_texCoord;

    void main() {
        vec2 pos = a_position * u_size - u_size * 0.5;
        float cosR = cos(u_rotation);
        float sinR = sin(u_rotation);
        vec2 rotatedPos = vec2(
            pos.x * cosR - pos.y * sinR,
            pos.x * sinR + pos.y * cosR
        );
        vec2 finalPos = rotatedPos + u_translation + u_size * 0.5;
        vec2 zeroToOne = finalPos / u_resolution;
        vec2 zeroToTwo = zeroToOne * 2.0;
        vec2 clipSpace = zeroToTwo - 1.0;
        gl_Position = vec4(clipSpace * vec2(1, -1), 0, 1);
        v_texCoord = a_texCoord;
    }
`;
const texturedFragmentSrc = `
    precision mediump float;
    varying vec2 v_texCoord;
    uniform sampler2D u_texture;
    uniform vec4 u_tintColor;
    uniform bool u_useTint;

    void main() {
        vec4 texColor = texture2D(u_texture, v_texCoord);
        // Only render pixels that have alpha, ignore transparent borders
        if (texColor.a < 0.1) {
            discard;
        }
        
        if (u_useTint) {
            // For arrow - apply tint color but keep original alpha
            gl_FragColor = vec4(u_tintColor.rgb, texColor.a);
        } else {
            // For text - use original color
            gl_FragColor = texColor;
        }
    }
`;

function createShader(gl, type, source) {
    const shader = gl.createShader(type);
    gl.shaderSource(shader, source);
    gl.compileShader(shader);
    if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error("Shader compile failed:", gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
    }
    return shader;
}

function createProgram(gl, vertexShader, fragmentShader) {
    const program = gl.createProgram();
    gl.attachShader(program, vertexShader);
    gl.attachShader(program, fragmentShader);
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        console.error("Program linking failed:", gl.getProgramInfoLog(program));
        gl.deleteProgram(program);
        return null;
    }
    return program;
}

const vertexShader = createShader(gl, gl.VERTEX_SHADER, vertexShaderSource);
const fragmentShader = createShader(gl, gl.FRAGMENT_SHADER, fragmentShaderSource);
const colorProgram = createProgram(gl, vertexShader, fragmentShader);

// Create gradient program
const gradientFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, gradientFragmentSource);
const gradientProgram = createProgram(gl, vertexShader, gradientFragmentShader);

const texturedVertexShader = createShader(gl, gl.VERTEX_SHADER, texturedVertexSrc);
const texturedFragmentShader = createShader(gl, gl.FRAGMENT_SHADER, texturedFragmentSrc);
const texturedProgram = createProgram(gl, texturedVertexShader, texturedFragmentShader);

const positionAttribLoc = gl.getAttribLocation(colorProgram, "a_position");
const resolutionUniformLoc = gl.getUniformLocation(colorProgram, "u_resolution");
const colorUniformLoc = gl.getUniformLocation(colorProgram, "u_color");

// Gradient program uniforms
const gradientPositionLoc = gl.getAttribLocation(gradientProgram, "a_position");
const gradientResolutionLoc = gl.getUniformLocation(gradientProgram, "u_resolution");
const gradientTopYLoc = gl.getUniformLocation(gradientProgram, "u_topY");
const gradientBottomYLoc = gl.getUniformLocation(gradientProgram, "u_bottomY");
const gradientTopColorLoc = gl.getUniformLocation(gradientProgram, "u_topColor");
const gradientBottomColorLoc = gl.getUniformLocation(gradientProgram, "u_bottomColor");

const texPositionLoc = gl.getAttribLocation(texturedProgram, "a_position");
const texTexCoordLoc = gl.getAttribLocation(texturedProgram, "a_texCoord");
const texResolutionLoc = gl.getUniformLocation(texturedProgram, "u_resolution");
const texTranslationLoc = gl.getUniformLocation(texturedProgram, "u_translation");
const texSizeLoc = gl.getUniformLocation(texturedProgram, "u_size");
const texRotationLoc = gl.getUniformLocation(texturedProgram, "u_rotation");
const texTintColorLoc = gl.getUniformLocation(texturedProgram, "u_tintColor");
const texUseTintLoc = gl.getUniformLocation(texturedProgram, "u_useTint");
const texSamplerLoc = gl.getUniformLocation(texturedProgram, "u_texture");

const positionBuffer = gl.createBuffer();
const gradientBuffer = gl.createBuffer();

const texPositionBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, texPositionBuffer);
const quadPositions = [
    0, 0,
    1, 0,
    0, 1,
    1, 1,
];
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadPositions), gl.STATIC_DRAW);

const texCoordBuffer = gl.createBuffer();
gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
const quadTexCoords = [
    0, 0,
    1, 0,
    0, 1,
    1, 1,
];
gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(quadTexCoords), gl.STATIC_DRAW);

const textCanvas = document.createElement("canvas");
const textCtx = textCanvas.getContext("2d");
const textTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, textTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);

// Extract static info from HTML data attributes
const platform = canvas.dataset.platform || "Platform";
const logoSrc = canvas.dataset.logo;
const pair = canvas.dataset.pair || "BTCUSDT";

let priceHistory = [];
const maxPoints = 450;
let currentValue = 528.80;
let displayedMin = null;
let displayedMax = null;
const scaleLerpFactor = 0.15;

let arrowTexture = null;
let arrowLoaded = false;
let logoTexture = null;
let logoLoaded = false;

// Create additional canvas and texture for platform/pair text
const platformTextCanvas = document.createElement("canvas");
const platformTextCtx = platformTextCanvas.getContext("2d");
const platformTextTexture = gl.createTexture();
gl.bindTexture(gl.TEXTURE_2D, platformTextTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

const imgArrow = new Image();
imgArrow.src = "/src/up_arrow.png";
imgArrow.onload = () => {
    arrowTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, arrowTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgArrow);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    arrowLoaded = true;
    checkAllLoaded();
};

const imgLogo = new Image();
imgLogo.src = logoSrc;
imgLogo.onload = () => {
    logoTexture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, logoTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imgLogo);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    logoLoaded = true;
    checkAllLoaded();
};

function checkAllLoaded() {
    if (arrowLoaded && logoLoaded) {
        updatePlatformTextTexture();
        startSimulation();
    }
}

// Catmull-Rom spline interpolation for smooth curves
function catmullRomSpline(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    
    const x = 0.5 * ((2 * p1[0]) +
        (-p0[0] + p2[0]) * t +
        (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
        (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
    
    const y = 0.5 * ((2 * p1[1]) +
        (-p0[1] + p2[1]) * t +
        (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
        (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
    
    return [x, y];
}

// Generate smooth curve points
function generateSmoothCurve(points) {
    if (points.length < 4) return points;
    
    const smoothPoints = [];
    const segments = 8; // Number of interpolated points between each pair
    
    for (let i = 0; i < points.length - 1; i++) {
        const p0 = i === 0 ? points[0] : points[i - 1];
        const p1 = points[i];
        const p2 = points[i + 1];
        const p3 = i === points.length - 2 ? points[points.length - 1] : points[i + 2];
        
        for (let j = 0; j < segments; j++) {
            const t = j / segments;
            const smoothPoint = catmullRomSpline(p0, p1, p2, p3, t);
            smoothPoints.push(smoothPoint);
        }
    }
    
    // Add the last point
    smoothPoints.push(points[points.length - 1]);
    return smoothPoints;
}

// Create thick line using triangle strip
function createThickLineVertices(points, thickness) {
    const vertices = [];
    const halfThickness = thickness / 2;
    
    for (let i = 0; i < points.length; i++) {
        let normal;
        
        if (i === 0) {
            // First point - use direction to next point
            const dx = points[i + 1][0] - points[i][0];
            const dy = points[i + 1][1] - points[i][1];
            const length = Math.sqrt(dx * dx + dy * dy);
            normal = [-dy / length, dx / length];
        } else if (i === points.length - 1) {
            // Last point - use direction from previous point
            const dx = points[i][0] - points[i - 1][0];
            const dy = points[i][1] - points[i - 1][1];
            const length = Math.sqrt(dx * dx + dy * dy);
            normal = [-dy / length, dx / length];
        } else {
            // Middle points - average of adjacent directions
            const dx1 = points[i][0] - points[i - 1][0];
            const dy1 = points[i][1] - points[i - 1][1];
            const length1 = Math.sqrt(dx1 * dx1 + dy1 * dy1);
            
            const dx2 = points[i + 1][0] - points[i][0];
            const dy2 = points[i + 1][1] - points[i][1];
            const length2 = Math.sqrt(dx2 * dx2 + dy2 * dy2);
            
            const n1 = [-dy1 / length1, dx1 / length1];
            const n2 = [-dy2 / length2, dx2 / length2];
            
            const nx = (n1[0] + n2[0]) / 2;
            const ny = (n1[1] + n2[1]) / 2;
            const length = Math.sqrt(nx * nx + ny * ny);
            normal = [nx / length, ny / length];
        }
        
        // Add two vertices for each point (top and bottom of thick line)
        vertices.push(
            points[i][0] + normal[0] * halfThickness,
            points[i][1] + normal[1] * halfThickness,
            points[i][0] - normal[0] * halfThickness,
            points[i][1] - normal[1] * halfThickness
        );
    }
    
    return vertices;
}

function drawGraphLine() {
    if (priceHistory.length < 6) return;

    const graphHeight = 60;
    const graphWidth = canvas.width - 160;
    const bottom = canvas.height - 117;
    const left = 80;

    const trueMin = Math.min(...priceHistory) - 3;
    const trueMax = Math.max(...priceHistory) - 3;

    if (displayedMin === null) displayedMin = trueMin;
    if (displayedMax === null) displayedMax = trueMax;

    displayedMin += (trueMin - displayedMin) * scaleLerpFactor;
    displayedMax += (trueMax - displayedMax) * scaleLerpFactor;

    const range = displayedMax - displayedMin + 2 || 1;
    const originalPoints = priceHistory.map((price, i) => {
        const x = left + (i / (maxPoints - 1)) * (graphWidth);
        const y = bottom - ((price - displayedMin) / range) * graphHeight;
        return [x, y];
    });

    // Generate smooth curve points
    const smoothPoints = generateSmoothCurve(originalPoints);

    // Create gradient fill using triangle strip with smooth points
    const gradientVertices = [];
    
    // Create pairs of vertices: one at the line point, one at the bottom
    for (let i = 0; i < smoothPoints.length; i++) {
        // Top vertex (line point)
        gradientVertices.push(smoothPoints[i][0], smoothPoints[i][1]);
        // Bottom vertex (at baseline)
        gradientVertices.push(smoothPoints[i][0], bottom);
    }

    // Draw gradient fill
    gl.useProgram(gradientProgram);
    
    gl.bindBuffer(gl.ARRAY_BUFFER, gradientBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(gradientVertices), gl.STATIC_DRAW);
    
    gl.enableVertexAttribArray(gradientPositionLoc);
    gl.vertexAttribPointer(gradientPositionLoc, 2, gl.FLOAT, false, 0, 0);
    
    gl.uniform2f(gradientResolutionLoc, canvas.width, canvas.height);
    gl.uniform1f(gradientTopYLoc, canvas.height - Math.min(...smoothPoints.map(p => p[1])));
    gl.uniform1f(gradientBottomYLoc, canvas.height - bottom);
    
    // Convert #cf1d45 to rgba with alpha for gradient
    gl.uniform4f(gradientTopColorLoc, 207/255, 29/255, 69/255, 0.4); // Top color with some transparency
    gl.uniform4f(gradientBottomColorLoc, 207/255, 29/255, 69/255, 0.0); // Bottom color fully transparent
    
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, gradientVertices.length / 2);

    // Draw thick smooth line
    const lineThickness = 3.0; // Adjust thickness here
    const thickLineVertices = createThickLineVertices(smoothPoints, lineThickness);

    gl.useProgram(colorProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(thickLineVertices), gl.STATIC_DRAW);

    gl.enableVertexAttribArray(positionAttribLoc);
    gl.vertexAttribPointer(positionAttribLoc, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(resolutionUniformLoc, canvas.width, canvas.height);
    // Changed color to #cf1d45
    gl.uniform4f(colorUniformLoc, 207/255, 29/255, 69/255, 1);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, thickLineVertices.length / 2);
}

function drawTexturedQuad(texture, x, y, width, height, rotation = 0, tintColor = [1, 1, 1, 1], useTint = false) {
    gl.useProgram(texturedProgram);

    gl.bindBuffer(gl.ARRAY_BUFFER, texPositionBuffer);
    gl.enableVertexAttribArray(texPositionLoc);
    gl.vertexAttribPointer(texPositionLoc, 2, gl.FLOAT, false, 0, 0);

    gl.bindBuffer(gl.ARRAY_BUFFER, texCoordBuffer);
    gl.enableVertexAttribArray(texTexCoordLoc);
    gl.vertexAttribPointer(texTexCoordLoc, 2, gl.FLOAT, false, 0, 0);

    gl.uniform2f(texResolutionLoc, canvas.width, canvas.height);
    gl.uniform2f(texTranslationLoc, x, y);
    gl.uniform2f(texSizeLoc, width, height);
    gl.uniform1f(texRotationLoc, rotation);
    gl.uniform4fv(texTintColorLoc, tintColor);
    gl.uniform1i(texUseTintLoc, useTint ? 1 : 0);

    gl.activeTexture(gl.TEXTURE0);
    gl.bindTexture(gl.TEXTURE_2D, texture);
    gl.uniform1i(texSamplerLoc, 0);

    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
}

function updatePlatformTextTexture() {
    const platformText = `${platform} / ${pair}`;
    
    // Use high DPI scaling for crisp text
    const dpr = window.devicePixelRatio || 1;
    const fontSize = 36;
    const scaledFontSize = fontSize * dpr;
    
    // Set up high-resolution context
    platformTextCtx.font = `${scaledFontSize}px 'Ida Light', Arial, sans-serif`;
    const textMetrics = platformTextCtx.measureText(platformText);
    
    // Calculate dimensions including logo space
    const logoSize = 28 * dpr;
    const spacing = 10 * dpr;
    const textWidth = Math.ceil(textMetrics.width);
    const totalWidth = logoSize + spacing + textWidth;
    const totalHeight = Math.max(logoSize, scaledFontSize * 1.2);
    
    platformTextCanvas.width = totalWidth;
    platformTextCanvas.height = totalHeight;
    
    // Enable high-quality text rendering
    platformTextCtx.imageSmoothingEnabled = true;
    platformTextCtx.imageSmoothingQuality = 'high';
    platformTextCtx.textRenderingOptimization = 'optimizeQuality';
    
    // Clear with transparent background
    platformTextCtx.clearRect(0, 0, totalWidth, totalHeight);
    
    // Draw logo first with high quality
    if (logoLoaded) {
        const logoY = (totalHeight - logoSize) / 2;
        platformTextCtx.drawImage(imgLogo, 0, logoY, logoSize, logoSize);
        
        // Apply white tint to logo (convert to white while preserving alpha)
        const imageData = platformTextCtx.getImageData(0, logoY, logoSize, logoSize);
        const data = imageData.data;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0) { // If pixel has alpha
                data[i] = 255;     // Red = 255
                data[i + 1] = 255; // Green = 255
                data[i + 2] = 255; // Blue = 255
                // Keep original alpha (data[i + 3])
            }
        }
        platformTextCtx.putImageData(imageData, 0, logoY);
    }
    
    // Draw high-quality text
    platformTextCtx.font = `${scaledFontSize}px 'Ida Light', Arial, sans-serif`;
    platformTextCtx.textAlign = 'left';
    platformTextCtx.textBaseline = 'middle';
    platformTextCtx.fillStyle = 'white';
    
    // Enable sub-pixel text rendering
    platformTextCtx.textRenderingOptimization = 'optimizeQuality';
    
    const textX = logoSize + spacing;
    const textY = totalHeight / 2 ;
    platformTextCtx.fillText(platformText, textX, textY);
    
    // Update texture with linear filtering for smooth scaling
    gl.bindTexture(gl.TEXTURE_2D, platformTextTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, platformTextCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function updatePriceTextTexture(price, goingUp) {
    const priceText = `$ ${price.toFixed(2)}`;

    // Use high DPI scaling for crisp text
    const dpr = window.devicePixelRatio || 1;
    const fontSize = 69;
    const scaledFontSize = fontSize * dpr;
    
    // Set up high-resolution context
    textCtx.font = `bold ${scaledFontSize}px Arial, sans-serif`;
    const metrics = textCtx.measureText(priceText);
    
    // Calculate high-resolution dimensions
    const width = Math.ceil(metrics.width + 4 * dpr); // Add small padding
    const height = Math.ceil(scaledFontSize * 1.2); // Add line height

    textCanvas.width = width;
    textCanvas.height = height;

    // Enable high-quality text rendering
    textCtx.imageSmoothingEnabled = true;
    textCtx.imageSmoothingQuality = 'high';
    textCtx.textRenderingOptimization = 'optimizeQuality';

    // Clear with fully transparent background
    textCtx.clearRect(0, 0, width, height);
    
    // Set up high-quality text rendering
    textCtx.font = `${scaledFontSize}px Arial, sans-serif`;
    textCtx.textAlign = 'left';
    textCtx.textBaseline = 'top';
    textCtx.fillStyle = goingUp ? "#67a86a" : "#e74c3c";
    
    // Add subtle text shadow for better definition
    textCtx.shadowColor = 'rgba(0, 0, 0, 0.3)';
    textCtx.shadowBlur = 2 * dpr;
    textCtx.shadowOffsetX = 1 * dpr;
    textCtx.shadowOffsetY = 1 * dpr;
    
    // Draw text at proper position with padding
    textCtx.fillText(priceText, 2 * dpr, (height - scaledFontSize) / 2);

    // Update texture with linear filtering for smooth scaling
    gl.bindTexture(gl.TEXTURE_2D, textTexture);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, textCanvas);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
}

function drawAll(newValue) {
    const goingUp = newValue >= currentValue;
    const arrowRotation = goingUp ? Math.PI / 2 : -Math.PI / 2;
    const tintColor = goingUp ? [0.35, 0.64, 0.39, 1] : [0.91, 0.3, 0.24, 1];

    priceHistory.push(newValue);
    if (priceHistory.length > maxPoints) priceHistory.shift();

    gl.viewport(0, 0, canvas.width, canvas.height);
    gl.clear(gl.COLOR_BUFFER_BIT);

    // Enable blending for gradient transparency
    gl.enable(gl.BLEND);
    gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

    drawGraphLine();

    // Keep blending enabled for text anti-aliasing
    updatePriceTextTexture(newValue, goingUp);

    // Scale text rendering to account for high DPI
    const dpr = window.devicePixelRatio || 1;
    const textWidth = textCanvas.width / dpr;
    const textHeight = textCanvas.height / dpr;
    const centerX = (canvas.width - textWidth) / 2 - 32;
    const centerY = 172 - textHeight / 2;

    drawTexturedQuad(textTexture, centerX, centerY, textWidth, textHeight, 0, [1, 1, 1, 1], false);

    if (arrowLoaded) {
        const maxArrowHeight = 32;
        const arrowAspect = imgArrow.width / imgArrow.height;
        const arrowHeight = maxArrowHeight;
        const arrowWidth = 52;

        const arrowX = centerX + textWidth + 10;
        const arrowY = centerY + (textHeight - arrowHeight) / 2 - 5;

        drawTexturedQuad(arrowTexture, arrowX, arrowY, arrowWidth, arrowHeight, arrowRotation, tintColor, true);
    }

    // Draw platform/pair text below price text with proper scaling
    const platformY = centerY + textHeight + 5;
    const platformWidth = platformTextCanvas.width / dpr;
    const platformHeight = platformTextCanvas.height / dpr;
    const platformX = (canvas.width - platformWidth) / 2;
    
    drawTexturedQuad(platformTextTexture, platformX, platformY, platformWidth, platformHeight, 0, [1, 1, 1, 1], false);

    gl.disable(gl.BLEND);

    //currentValue = newValue;
}
let iters = 0;
function animationSimulation(change, newvalue) {
    return new Promise((resolve) => {
        let curVal = currentValue;
        let steps = 25;
        let i = 0;
        let stepChange = change / steps;

        function anim() {
            if (i >= steps) {
                curVal = newvalue;
                drawAll(curVal);
                resolve(curVal);  // ✅ Waits until animation is done
                return;
            }

            curVal += stepChange;
            drawAll(curVal);
            i++;
            setTimeout(anim, 10);
        }

        anim();
    });
}

async function startSimulation() {
    while (true) {
        const change = (Math.random() - 0.5) * 2;
        const newValue = currentValue + change;
        currentValue = await animationSimulation(change, newValue);
        //console.log("Done:", currentValue);
        await new Promise(r => setTimeout(r, 250));
    }
}
