// ======================================================
// Raumdesigner – Schritt 2: Canvas-Initialisierung + Raster
// ======================================================

const RoomDesigner = {
    canvas: null,
    ctx: null,

    init() {
        this.canvas = document.getElementById("roomdesigner");
        if (!this.canvas) {
            console.warn("RoomDesigner: Canvas #roomdesigner nicht gefunden.");
            return;
        }

        this.ctx = this.canvas.getContext("2d");

        // Events
        window.addEventListener("resize", () => this.resize());

        // Initial
        this.resize();
        this.render();
    },

    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.render();
    },

    render() {
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid();
        this.drawPlaceholder();
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

    drawPlaceholder() {
        const ctx = this.ctx;
        ctx.fillStyle = "rgba(255,255,255,0.3)";
        ctx.font = "20px system-ui";
        ctx.fillText("Raumdesigner – Basis (Schritt 2)", 20, 40);
    }
};

// Automatisch starten, wenn der Canvas existiert
window.addEventListener("DOMContentLoaded", () => {
    const canvas = document.getElementById("roomdesigner");
    if (canvas) {
        RoomDesigner.init();
    }
});

