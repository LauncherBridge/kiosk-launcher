// SmartHome Rendering Engine

window.SmartHomeView = {
    canvas: null,
    ctx: null,
    overlay: null,

    init() {
        this.canvas = document.getElementById("smarthome-canvas");
        this.overlay = document.getElementById("smarthome-overlay");

        if (!this.canvas) {
            console.error("SmartHomeView: Canvas not found");
            return;
        }

        this.ctx = this.canvas.getContext("2d");

        this._resize();
        window.addEventListener("resize", () => this._resize());

        this._drawPlaceholder();
    },

    _resize() {
        this.canvas.width = this.canvas.offsetWidth;
        this.canvas.height = this.canvas.offsetHeight;
    },

    _drawPlaceholder() {
        const ctx = this.ctx;
        if (!ctx) return;

        ctx.fillStyle = "#FFFFFF22";
        ctx.font = "20px sans-serif";
        ctx.fillText("Rendering Engine aktiv (Schritt 2)", 20, 40);
    }
};

