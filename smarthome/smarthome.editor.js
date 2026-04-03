// ======================================================
// Raumdesigner – Schritt 3: Punkte setzen + Linien verbinden
// ======================================================

const RoomDesigner = {
    canvas: null,
    ctx: null,

    points: [],        // gesetzte Punkte
    hover: { x: 0, y: 0 }, // Mausposition

    init() {
        this.canvas = document.getElementById("roomdesigner");
        if (!this.canvas) {
            console.warn("RoomDesigner: Canvas #roomdesigner nicht gefunden.");
            return;
        }

        this.ctx = this.canvas.getContext("2d");

        // Events
        window.addEventListener("resize", () => this.resize());
        this.canvas.addEventListener("mousemove", (e) => this.onMove(e));
        this.canvas.addEventListener("click", (e) => this.onClick(e));

        // Initial
        this.resize();
        this.render();
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.render();
    },

    // -------------------------
    // Eingaben
    // -------------------------
    onMove(e) {
        const rect = this.canvas.getBoundingClientRect();
        this.hover.x = e.clientX - rect.left;
        this.hover.y = e.clientY - rect.top;
        this.render();
    },

    onClick(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        this.points.push({ x, y });
        this.render();
    },

    // -------------------------
    // Rendering
    // -------------------------
    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid();
        this.drawPolygon();
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

        // Linien
        ctx.strokeStyle = "#4a90e2";
        ctx.lineWidth = 2;

        ctx.beginPath();
        ctx.moveTo(pts[0].x, pts[0].y);

        for (let i = 1; i < pts.length; i++) {
            ctx.lineTo(pts[i].x, pts[i].y);
        }

        ctx.stroke();

        // Punkte
        for (const p of pts) {
            ctx.fillStyle = "#ffffff";
            ctx.beginPath();
            ctx.arc(p.x, p.y, 4, 0, Math.PI * 2);
            ctx.fill();
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
    }
};

// Automatisch starten, wenn der Canvas existiert
window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("roomdesigner");
    if (canvas) {
        RoomDesigner.init();
    }
});
