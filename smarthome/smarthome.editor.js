<!DOCTYPE html>
<html lang="de">
<head>
<meta charset="UTF-8">
<title>Raumdesigner – Basis</title>
<style>
  body {
    margin: 0;
    background: #111;
    display: flex;
    height: 100vh;
    overflow: hidden;
    font-family: system-ui, sans-serif;
  }

  #roomdesigner {
    flex: 1;
    background: #000;
    cursor: crosshair;
  }
</style>
</head>
<body>

<canvas id="roomdesigner"></canvas>

<script>
const canvas = document.getElementById("roomdesigner");
const ctx = canvas.getContext("2d");

// Größe dynamisch anpassen
function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
  render();
}
window.addEventListener("resize", resize);
resize();

// Basis-Renderfunktion
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Hintergrundraster (RE-Stil: dunkel, technisch)
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  ctx.lineWidth = 1;

  const grid = 40;
  for (let x = 0; x < canvas.width; x += grid) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += grid) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Platzhalter-Text
  ctx.fillStyle = "rgba(255,255,255,0.3)";
  ctx.font = "20px system-ui";
  ctx.fillText("Raumdesigner – Schritt 1 (Basis)", 20, 40);
}
</script>

</body>
</html>

