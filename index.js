const canvas = document.getElementById("cryptoGraphWidget");
const ctx = canvas.getContext("2d");

// Extract static info from HTML data attributes
const platform = canvas.dataset.platform || "Platform";
const logoSrc = canvas.dataset.logo;
const pair = canvas.dataset.pair || "BTCUSDT";

const logoImg = new Image();
logoImg.src = logoSrc;

const imgArrow = new Image();
imgArrow.src = "/src/up_arrow.png";

let currentValue = 528.80;
const priceHistory = [];
const maxPoints = 35;

let displayedMin = null;
let displayedMax = null;
const scaleLerpFactor = 0.1;

// Simple smooth scrolling
let smoothOffset = 0;

function drawTextWithLetterSpacing(ctx, text, x, y, spacing) {
    let currentX = x;

    for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const metrics = ctx.measureText(char);
        const ascent = metrics.actualBoundingBoxAscent || 0;
        const offsetY = ascent / 2;

        ctx.textAlign = "left";
        ctx.textBaseline = "middle";
        ctx.fillText(char, currentX, y);

        let extraSpacing = spacing;

        // Optional tweak: reduce space after narrow characters like '.'
        if (char === '.' || char === ',') {
            extraSpacing *= 0.3; // or even 0
        }

        // Don't apply spacing after the last character
        if (i < text.length - 1) {
            currentX += metrics.width + extraSpacing;
        } else {
            currentX += metrics.width;
        }
    }
}



function drawGraph() {
    if (priceHistory.length < 2) return;

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

    const points = priceHistory.map((price, i) => {
        const x = left + (i / (maxPoints - 1)) * graphWidth + smoothOffset;
        const y = bottom - ((price - displayedMin) / range) * graphHeight;
        return { x, y };
    });

    // Draw gradient-filled area
    ctx.beginPath();
    ctx.moveTo(points[0].x, bottom);
    points.forEach(p => ctx.lineTo(p.x, p.y));
    ctx.lineTo(points[points.length - 1].x, bottom);
    ctx.closePath();

    const gradient = ctx.createLinearGradient(0, bottom - graphHeight, 0, bottom);
    gradient.addColorStop(0, "rgba(255, 0, 64, 0.55)");
    gradient.addColorStop(1, "rgba(255, 0, 64, 0.0)");
    ctx.fillStyle = gradient;
    ctx.fill();

    // Draw smooth red curve
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    for (let i = 1; i < points.length - 2; i++) {
        const xc = (points[i].x + points[i + 1].x) / 2;
        const yc = (points[i].y + points[i + 1].y) / 2;
        ctx.quadraticCurveTo(points[i].x, points[i].y, xc, yc);
    }
    const penultimate = points[points.length - 2];
    const last = points[points.length - 1];
    ctx.quadraticCurveTo(penultimate.x, penultimate.y, last.x, last.y);

    ctx.strokeStyle = "#ff0040";
    ctx.lineWidth = 3.5;
    ctx.stroke();
}

function drawPrice(newValue) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    priceHistory.push(newValue);
    if (priceHistory.length > maxPoints) {
        priceHistory.shift();
    }

    drawGraph();

    // Draw price text
    const text = `$ ${newValue.toFixed(2)}`;
    const isUp = newValue >= currentValue;
    ctx.font = "69px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillStyle = isUp ? "#59a262" : "#e74c3c";

    let textX = canvas.width / 2 - 167;
    const textY = 172;
    drawTextWithLetterSpacing(ctx, text, textX, textY, 2.2);
    //ctx.fillText(text, textX, textY);

    const textWidth = ctx.measureText(text).width;
    const arrowX = textX + textWidth / 2 + 182;
    const arrowY = textY - 5;
    const arrowColor = isUp ? "#59a262" : "#e74c3c";
    const arrowRotation = isUp ? Math.PI / 2 : -Math.PI / 2;

    // Draw arrow
    if (imgArrow.complete) {
        ctx.save();
        ctx.translate(arrowX, arrowY);
        ctx.rotate(arrowRotation);

        ctx.drawImage(imgArrow, -26, -16, 52, 32);

        ctx.globalCompositeOperation = "source-atop";
        ctx.fillStyle = arrowColor;
        ctx.fillRect(-26, -16, 52, 32);
        ctx.globalCompositeOperation = "source-over";
        ctx.restore();
    }

    // Draw logo and pair below price
    const infoY = textY + 71;
    const logoSize = 30;
    const spacing = 10;
    const textAfterLogo = `${platform} / ${pair}`;

    ctx.font = "36px 'Ida Light', Arial";
    ctx.textBaseline = "middle";
    ctx.textAlign = "left";
    const logoX = (canvas.width - ctx.measureText(textAfterLogo).width - logoSize - spacing) / 2;

    if (logoImg.complete && logoImg.naturalWidth !== 0) {
        ctx.drawImage(logoImg, logoX, infoY - logoSize / 2 - 3, logoSize, logoSize);
        ctx.save();
        ctx.globalCompositeOperation = 'source-atop';
        ctx.fillStyle = 'white';
        ctx.fillRect(logoX, infoY - logoSize / 2 - 3, logoSize, logoSize);
        ctx.restore();
    }

    ctx.fillStyle = "white";
    drawTextWithLetterSpacing(ctx, textAfterLogo, logoX + logoSize + spacing, infoY, 0.6)
   // ctx.fillText(textAfterLogo, logoX + logoSize + spacing, infoY);

    currentValue = newValue;
}

function startSimulation() {
    function update() {
        const change = (Math.random() - 0.5) * 2;
        const newValue = currentValue + change;
        drawPrice(newValue);
        setTimeout(update, 250);
    }
    update();
}

let arrowLoaded = false;
let logoLoaded = false;

imgArrow.onload = () => {
    arrowLoaded = true;
    if (logoLoaded) startSimulation();
};

logoImg.onload = () => {
    logoLoaded = true;
    if (arrowLoaded) startSimulation();
};