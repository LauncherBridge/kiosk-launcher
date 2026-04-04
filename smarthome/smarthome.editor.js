// ======================================================
// Raumdesigner – Schritte 1 bis 6
// Canvas-Init, Raster, Punkte setzen, verschieben,
// löschen, Raum schließen, Wände erkennen, Türen setzen
// ======================================================

const RoomDesigner = {
    canvas: null,
    ctx: null,

    points: [],
    walls: [],
    doors: [],          // Schritt 6
    mode: "points",     // Schritt 6
    hover: { x: 0, y: 0 },

    selectedPoint: null,
    isDragging: false,
    _initialized: false,

    // --------------------------------------------------
    // Initialisierung
    // --------------------------------------------------
    init() {
        if (this._initialized) return;
        this._initialized = true;

        this.canvas = document.getElementById("roomdesigner");
        if (!this.canvas) {
            console.warn("RoomDesigner: Canvas #roomdesigner nicht gefunden.");
            return;
        }

        this.ctx = this.canvas.getContext("2d");

        // Events
        window.addEventListener("resize", () => this.resize());
        this.canvas.addEventListener("mousemove", (e) => this.onMove(e));
        this.canvas.addEventListener("mousedown", (e) => this.onDown(e));
        this.canvas.addEventListener("mouseup", () => this.onUp());
        this.canvas.addEventListener("contextmenu", (e) => this.onRightClick(e));

        this.setupDoorButton(); // Schritt 6

        this.resize();
        this.render();
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.render();
    },

    // --------------------------------------------------
    // Eingaben
    // --------------------------------------------------
    onMove(e) {
        const rect = this.canvas.getBoundingClientRect();
       let hx = e.clientX - rect.left;
let hy = e.clientY - rect.top;

// Magnetisches Einrasten auf ersten Punkt
if (this.points.length > 0) {
    const first = this.points[0];
    const dx = hx - first.x;
    const dy = hy - first.y;
    const dist = Math.sqrt(dx*dx + dy*dy);

    if (dist < 20) {   // Magnetradius
        hx = first.x;
        hy = first.y;
    }
}

this.hover.x = hx;
this.hover.y = hy;


        if (this.isDragging && this.selectedPoint) {
            this.selectedPoint.x = this.hover.x;
            this.selectedPoint.y = this.hover.y;
            this.updateWalls();
        }

        this.render();
    },

    onDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        // --------------------------------------------------
        // Schritt 6: Tür-Modus aktiv
        // --------------------------------------------------
        if (this.mode === "doors") {
            const hit = this.getWallAt(x, y);
            if (hit) {
                this.doors.push({
                    wallIndex: hit.index,
                    t: hit.t,
                    x: hit.x,
                    y: hit.y,
                    width: 80
                });
                this.render();
            }
            return;
        }

        // Rechtsklick wird separat behandelt
        if (e.button === 2) return;

        // Prüfen, ob ein Punkt getroffen wurde
        const hit = this.getPointAt(x, y);
        if (hit) {
            this.selectedPoint = hit;
            this.isDragging = true;
            return;
        }

        // Prüfen, ob der neue Punkt den Raum schließen soll
        if (this.points.length > 2) {
    const first = this.points[0];
    const dx = x - first.x;
    const dy = y - first.y;
    const dist = Math.sqrt(dx * dx + dy * dy);

    if (dist < 20) {
        // ECHTES Verschmelzen: letzten Punkt entfernen
        // und den Pfad mit dem ersten Punkt schließen
        this.points[this.points.length - 1] = first;
        this.updateWalls();
        this.render();
        return;
    }
}


        // Neuen Punkt setzen
        this.points.push({ x, y });
        this.updateWalls();
        this.render();
    },

    onUp() {
        this.isDragging = false;
        this.selectedPoint = null;
    },

    onRightClick(e) {
        e.preventDefault();

        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const hit = this.getPointAt(x, y);
        if (hit) {
            this.points = this.points.filter(p => p !== hit);
            this.updateWalls();
            this.render();
        }
    },

    // --------------------------------------------------
    // Hilfsfunktionen
    // --------------------------------------------------
    getPointAt(x, y) {
        return this.points.find(p => {
            const dx = p.x - x;
            const dy = p.y - y;
            return Math.sqrt(dx * dx + dy * dy) < 10;
        });
    },

    getWallAt(x, y) {
        for (let i = 0; i < this.walls.length; i++) {
            const w = this.walls[i];

            const A = { x: w.x1, y: w.y1 };
            const B = { x: w.x2, y: w.y2 };

            const ABx = B.x - A.x;
            const ABy = B.y - A.y;
            const APx = x - A.x;
            const APy = y - A.y;

            const abLen = Math.sqrt(ABx * ABx + ABy * ABy);
            if (abLen === 0) continue;

            const t = Math.max(0, Math.min(1, (APx * ABx + APy * ABy) / (abLen * abLen)));

            const closestX = A.x + t * ABx;
            const closestY = A.y + t * ABy;

            const dx = x - closestX;
            const dy = y - closestY;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist < 10) {
                return { index: i, t, x: closestX, y: closestY };
            }
        }
        return null;
    },

    updateWalls() {
        this.walls = [];

        if (this.points.length < 2) return;

        for (let i = 0; i < this.points.length - 1; i++) {
            const a = this.points[i];
            const b = this.points[i + 1];

            this.walls.push({
                x1: a.x, y1: a.y,
                x2: b.x, y2: b.y
            });
        }
    },

    // --------------------------------------------------
    // Rendering
    // --------------------------------------------------
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid();
        this.drawPolygon();
        this.drawWalls();
        this.drawDoors(); // Schritt 6
        this.drawHoverCross();
    },

    drawGrid() {
        const ctx = this.ctx;
        ctx.strokeStyle = "rgba(255,255,255,0.05)";
        ctx.lineWidth = 1;

        const grid = 40;

        for (let x = 0; x < this.canvas.width; x += grid) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }

        for (let y = 0; y < this.canvas.height; y += grid) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }
    },

    drawPolygon() {
        const ctx = this.ctx;
        const pts = this.points;

        if (pts.length === 0) return;

        ctx.strokeStyle = "#4a90e2";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);

        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }

        ctx.stroke();

        for (const p of pts) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
            ctx.fill();
        }
    },

    drawWalls() {
        const ctx = this.ctx;

        ctx.strokeStyle = "#ffcc00";
        ctx.lineWidth = 3;

        for (const w of this.walls) {
            ctx.beginPath();
            ctx.moveTo(w.x1, w.y1);
            ctx.lineTo(w.x2, w.y2);
            ctx.stroke();
        }
    },

    drawDoors() {
        const ctx = this.ctx;

        ctx.strokeStyle = "#00ffcc";
        ctx.lineWidth = 4;

        for (const d of this.doors) {
            const w = this.walls[d.wallIndex];
            if (!w) continue;

            const x = d.x;
            const y = d.y;

            const dx = w.x2 - w.x1;
            const dy = w.y2 - w.y1;
            const len = Math.sqrt(dx * dx + dy * dy);
            if (len === 0) continue;

            const nx = -dy / len;
            const ny = dx / len;

            const half = d.width / 2;

            ctx.beginPath();
            ctx.moveTo(x - nx * half, y - ny * half);
            ctx.lineTo(x + nx * half, y + ny * half);
            ctx.stroke();
        }
    },

    drawHoverCross() {
        const ctx = this.ctx;
        const { x, y } = this.hover;

        ctx.strokeStyle = "rgba(255,255,255,0.3)";
        ctx.lineWidth = 1;

        ctx.beginPath();
        ctx.moveTo(x - 10, y);
        ctx.lineTo(x + 10, y);
        ctx.stroke();

        ctx.beginPath();
        ctx.moveTo(x, y - 10);
        ctx.lineTo(x, y + 10);
        ctx.stroke();
    },

    // --------------------------------------------------
    // Schritt 6: Tür-Modus Button
    // --------------------------------------------------
    setupDoorButton() {
        const btn = document.getElementById("btnDoorMode");
        if (!btn) return;

        btn.addEventListener("click", () => {
            this.mode = (this.mode === "doors") ? "points" : "doors";
            btn.style.background = (this.mode === "doors") ? "#e29a4a" : "#4a90e2";
        });
    }
};

// --------------------------------------------------
// Debug: Editor öffnen
// --------------------------------------------------
window.addEventListener("DOMContentLoaded", () => {
    const openBtn = document.getElementById("btnOpenEditor");
    if (openBtn) {
        openBtn.addEventListener("click", () => {
            document.getElementById("smarthome-root").style.display = "none";
            document.getElementById("sh-group-header").style.display = "none";
            document.getElementById("smarthome-minimap").style.display = "none";

            document.getElementById("roomdesigner").style.display = "block";
            document.getElementById("btnDoorMode").style.display = "block";

            RoomDesigner.init();
        });
    }
});
