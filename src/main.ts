import "./style.css";

const PIXEL_SIZE = 50;
const PICTURE_START_POINT: Point = { x: 354, y: 752 };

type Point = {
  x: number;
  y: number;
};

type Color = {
  r: number;
  g: number;
  b: number;
  a: number;
};

class Pixel {
  constructor(
    public coordinates: Point,
    public color: Color,
  ) {}
}

type PixelsArray = Pixel[][];

function imageToPixelsArray(img: HTMLImageElement): PixelsArray {
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) throw new Error("Canvas context is not available.");

  canvas.width = img.width;
  canvas.height = img.height;

  context.drawImage(img, 0, 0, img.width, img.height);

  const imageData = context.getImageData(0, 0, img.width, img.height);
  const pixelsArray: PixelsArray = [];

  for (let y = 0; y < img.height; y++) {
    const row: Pixel[] = [];
    for (let x = 0; x < img.width; x++) {
      const index = (y * img.width + x) * 4;
      const r = imageData.data[index];
      const g = imageData.data[index + 1];
      const b = imageData.data[index + 2];
      const a = imageData.data[index + 3];

      const pixel = new Pixel(
        { x, y },
        { r, g, b, a }
      );

      row.push(pixel);
    }
    pixelsArray.push(row);
  }

  return pixelsArray;
}

class Application {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private scale: number = 1;
  private translate: Point = { x: 0, y: 0 };
  private field: Pixel[][] = [];
  private isDragging: boolean = false;
  private dragStart: Point = { x: 0, y: 0 };
  private lastTranslate: Point = { x: 0, y: 0 };
  private activePixel: Pixel | null = null;
  private pinchStartDistance: number | null = null;
  public onActivePixelChange: ((pixel: Pixel | null) => any) | null = null;

  constructor(image: HTMLImageElement) {
    const canvas = this.createCanvas();
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Cannot create Canvas context. Enable Javascript or Hardware acceleration if it's disabled.");
    this.canvas = canvas;
    this.ctx = ctx;

    const pixels = imageToPixelsArray(image);
    this.field = pixels;

    this.applyListeners();
  }

  private createCanvas(): HTMLCanvasElement {
    const canvas = document.createElement("canvas");
    canvas.style.cssText = `
      display: block;
      padding: 0px;
      margin: 0px;
      width: 100vw;
      height: 100vh;
    `;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
    return canvas;
  }

  public appendCanvas(target: HTMLElement): void {
    target.appendChild(this.canvas);
  }

  private getCanvasBoundings(): DOMRect {
    return this.canvas.getBoundingClientRect();
  }

  private clearCanvas(): void {
    const { width, height } = this.getCanvasBoundings();
    this.ctx.clearRect(0, 0, width, height);
  }

  private resizeCanvas(): void {
    this.canvas.width = window.innerWidth;
    this.canvas.height = window.innerHeight;
    this.canvas.style.width = "100vw";
    this.canvas.style.height = "100vh";
  }

  private applyListeners(): void {
    window.addEventListener('resize', this.resizeCanvas.bind(this));

    this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
    this.canvas.addEventListener('wheel', this.onWheel.bind(this));

    this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
    this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
    this.canvas.addEventListener('mouseleave', this.onMouseUp.bind(this));

    this.canvas.addEventListener('touchstart', this.onTouchStart.bind(this));
    this.canvas.addEventListener('touchmove', this.onTouchMove.bind(this));
    this.canvas.addEventListener('touchend', this.onTouchEnd.bind(this));
    this.canvas.addEventListener('gesturestart', this.onGestureStart.bind(this));
    this.canvas.addEventListener('gesturechange', this.onGestureChange.bind(this));
}


private onGestureStart(event: any): void {
  event.preventDefault();
  this.pinchStartDistance = this.getDistance(event.touches);
}

private onGestureChange(event: any): void {
  event.preventDefault();
  if (this.pinchStartDistance !== null) {
      const currentDistance = this.getDistance(event.touches);
      const scaleAmount = currentDistance / this.pinchStartDistance;
      this.scale *= scaleAmount;
      this.pinchStartDistance = currentDistance;
      this.render();
  }
}

private getDistance(touches: TouchList): number {
  const dx = touches[0].clientX - touches[1].clientX;
  const dy = touches[0].clientY - touches[1].clientY;
  return Math.sqrt(dx * dx + dy * dy);
}


  private onMouseMove(event: MouseEvent): void {
    if (this.isDragging) {
      this.onMouseMoveDrag(event);
    } else {
      this.detectActivePixel(event);
    }
  }

  private onMouseMoveDrag(event: MouseEvent): void {
    const deltaX = event.clientX - this.dragStart.x;
    const deltaY = event.clientY - this.dragStart.y;
    this.translate.x = this.lastTranslate.x + deltaX;
    this.translate.y = this.lastTranslate.y + deltaY;
    this.render();
  }

  private onMouseDown(event: MouseEvent): void {
    this.isDragging = true;
    this.dragStart = { x: event.clientX, y: event.clientY };
    this.lastTranslate = { ...this.translate };
  }

  private onMouseUp(): void {
    this.isDragging = false;
  }

  private onTouchStart(event: TouchEvent): void {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      this.isDragging = true;
      this.dragStart = { x: touch.clientX, y: touch.clientY };
      this.lastTranslate = { ...this.translate };
    }
  }

  private onTouchMove(event: TouchEvent): void {
    if (this.isDragging && event.touches.length === 1) {
      const touch = event.touches[0];
      const deltaX = touch.clientX - this.dragStart.x;
      const deltaY = touch.clientY - this.dragStart.y;
      this.translate.x = this.lastTranslate.x + deltaX;
      this.translate.y = this.lastTranslate.y + deltaY;
      this.render();
    }
  }

  private onTouchEnd(): void {
    this.isDragging = false;
  }

  private detectActivePixel(event: MouseEvent): void {
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = (event.clientX - rect.left - this.translate.x) / this.scale;
    const mouseY = (event.clientY - rect.top - this.translate.y) / this.scale;

    const pixelX = Math.floor(mouseX / PIXEL_SIZE);
    const pixelY = Math.floor(mouseY / PIXEL_SIZE);

    if (pixelX >= 0 && pixelY >= 0 && pixelY < this.field.length && pixelX < this.field[0].length) {
      this.activePixel = this.field[pixelY][pixelX];
      this.onActivePixelChange?.(this.activePixel);

    } else {
      this.activePixel = null;
      this.onActivePixelChange?.(null);
    }

    this.render();
  }

  private onWheel(event: WheelEvent): void {
    event.preventDefault();
    const rect = this.canvas.getBoundingClientRect();
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    const zoomFactor = 0.1;
    const scaleAmount = event.deltaY < 0 ? 1 + zoomFactor : 1 - zoomFactor;
    this.translate.x -= (mouseX - this.translate.x) * (scaleAmount - 1);
    this.translate.y -= (mouseY - this.translate.y) * (scaleAmount - 1);
    this.scale *= scaleAmount;
    this.render();
  }

  private drawImage(): void {
    for (const row of this.field) {
      for (const pixel of row) {
        this.ctx.fillStyle = `rgba(${pixel.color.r},${pixel.color.g},${pixel.color.b},1)`;
        this.ctx.fillRect(pixel.coordinates.x * PIXEL_SIZE, pixel.coordinates.y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
      }
    }

    if (this.activePixel) {
      const { x, y } = this.activePixel.coordinates;
      this.ctx.strokeStyle = "rgba(255, 0, 255, 1)";
      this.ctx.lineWidth = 2;
      this.ctx.strokeRect(x * PIXEL_SIZE, y * PIXEL_SIZE, PIXEL_SIZE, PIXEL_SIZE);
    }
  }

  private applyTransforms(): void {
    this.ctx.setTransform(this.scale, 0, 0, this.scale, this.translate.x, this.translate.y);
  }

  private render(): void {
    this.clearCanvas();
    this.applyTransforms();
    this.drawImage();
  }

  private update() {}

  public play() {
    this.update();
    this.render();
    window.requestAnimationFrame(this.play.bind(this));
  }
}

const img = new Image();
img.src = "/duck_pixel/image.png";

img.addEventListener("load", () => {
  const app = new Application(img);
  app.play();
  app.appendCanvas(document.body);
  const pixelInfo = document.getElementById("pixel_info") as HTMLDivElement;
  app.onActivePixelChange = (px) => {
    pixelInfo.innerHTML = "";
    if (!px) {
      pixelInfo.innerHTML = "";
      return;
    }
    const pos = document.createElement("div");
    pos.innerText = `Coordinates: (${px.coordinates.x + PICTURE_START_POINT.x}:${px.coordinates.y + PICTURE_START_POINT.y}) `;
    const col = document.createElement("div");
    col.innerText = `Color: rgba(${px.color.r}, ${px.color.g}, ${px.color.b}, 1)`;
    pixelInfo.appendChild(pos);
    pixelInfo.appendChild(col);
  };
});
