import Annotation from "./annotations/Annotation";
import Frame from "./Frame";
import EditedImage from "./EditedImage";
import TextAnnotation from "./annotations/TextAnnotation";
import RectangleAnnotation from "./annotations/RectangleAnnotation";

export default class ImageEditorCanvas {
  width: number;
  height: number;

  max_width: number;
  max_height: number;

  canvas: HTMLCanvasElement;
  context: CanvasRenderingContext2D | null;

  canvas_area: HTMLElement;

  editedImage: EditedImage;
  currentImage: HTMLImageElement;

  scale: number;
  angle: number;

  currentAnnotation: Annotation;
  currentFrame: Frame;

  cutListener: (e: MouseEvent) => void;
  textAreaListener: (e: MouseEvent) => void;

  resizeDownListener: (e: MouseEvent) => void;
  resizeMoveListener: (e: MouseEvent) => void;
  resizeUpListener: (e: MouseEvent) => void;
  resizeOverListener: (e: MouseEvent) => void;

  is_on_canvas: boolean;
  is_set_start_point: boolean;

  distance: {
    x: number;
    y: number;
  };

  start_point: {
    x: number;
    y: number;
  };

  start_position: {
    x: number;
    y: number;
  };

  AnnotationMouseDownListener: (e: MouseEvent) => void;
  AnnotationMouseMoveListener: (e: MouseEvent) => void;
  AnnotationMouseUpListener: (e: MouseEvent) => void;
  AnnotationOutCanvasMouseUpListener: (e: MouseEvent) => void;
  AnnotationMouseLeaveListener: (e: MouseEvent) => void;
  AnnotationMouseOverListener: (e: MouseEvent) => void;
  onDelListener: (e: KeyboardEvent) => void;

  current_editor: string;

  is_undo_inactive: boolean;
  is_redo_inactive: boolean;

  is_image_load: boolean;

  image_canvas_box: HTMLDivElement;

  constructor(canvas: HTMLCanvasElement, image_canvas_box: HTMLDivElement) {
    this.canvas = canvas;
    this.context = this.canvas.getContext("2d");

    this.max_width = 643;
    this.max_height = 400;

    this.is_image_load = false;

    this.image_canvas_box = image_canvas_box;

    const empty_image = new Image();
    this.editedImage = new EditedImage(empty_image, this.max_width, this.max_height);

    this.angle = 0;
    this.scale = 0;

    this.current_editor = "";

    this.is_undo_inactive = true;
    this.is_redo_inactive = true;

    this.width = 0;
    this.height = 0;

    this.canvas_area = document.createElement("div");
    this.currentImage = document.createElement("image") as HTMLImageElement;
    this.currentAnnotation = new Annotation();
    this.currentFrame = new Frame(0, 0, this.canvas_area);

    this.is_on_canvas = true;
    this.is_set_start_point = false;

    this.distance = {
      x: 0,
      y: 0,
    };
    this.start_point = {
      x: 0,
      y: 0,
    };
    this.start_position = {
      x: 0,
      y: 0,
    };

    this.cutListener = () => undefined;
    this.textAreaListener = () => undefined;
    this.resizeMoveListener = () => undefined;
    this.resizeDownListener = () => undefined;
    this.resizeUpListener = () => undefined;
    this.resizeOverListener = () => undefined;
    this.AnnotationMouseDownListener = () => undefined;
    this.AnnotationMouseMoveListener = () => undefined;
    this.AnnotationMouseUpListener = () => undefined;

    this.AnnotationOutCanvasMouseUpListener = () => undefined;
    this.AnnotationMouseLeaveListener = () => undefined;
    this.AnnotationMouseOverListener = () => undefined;

    this.onDelListener = () => undefined;
  }

  /**
   * Загрузка изображения на холст.
   * @param image {HTMLImageElement} - элемент изображения.
   */
  loadImage(image: HTMLImageElement) {
    if (!this.is_image_load) {
      this.editedImage = new EditedImage(image, this.max_width, this.max_height);
    }

    this.is_image_load = true;

    this.currentImage = image;

    this.redraw();
  }

  /**
   * Выгрузка изменённого изображения с холста
   */
  uploadImage() {
    this.applyChanges();

    this.canvas.width = this.editedImage.size.width;
    this.canvas.height = this.editedImage.size.height;

    this.canvas.style.width = this.editedImage.size.width + "px";
    this.canvas.style.height = this.editedImage.size.height + "px";

    if (this.context !== null)
      this.context.drawImage(
        this.editedImage.current,
        0,
        0,
        this.editedImage.size.width,
        this.editedImage.size.height,
      );

    return new Promise<Blob | null>((resolve) => {
      this.canvas.toBlob(resolve);
    });
  }

  /**
   * Отмена в истории
   * @return {number} - 0: Нельзя выполнить отмену; 1: Выполнена отмена; 2: Выполнена отмена и достигнуто начало истории.
   */
  undo(): number {
    const flag = this.editedImage.backHistory();

    if (flag) {
      if (this.editedImage.history_index === 0) return 2;
      else return 1;
    } else return 0;
  }

  /**
   * Возврат в истории
   * @return {number} - 0: Нельзя выполнить возврат; 1: Выполнен возврат; 2: Выполнен возврат и достигнут конец истории.
   */
  redo(): number {
    const flag = this.editedImage.forwardHistory();

    if (flag) {
      if (this.editedImage.history_index === this.editedImage.history.length - 1)
        return 2;
      else return 1;
    } else return 0;
  }

  /**
   * Изменение размера изображения
   * @param width {number} - новая ширина
   * @param height {number} - новая высота
   */
  resize(width: number, height: number) {
    // Изменение размера холста
    if (this.context !== null)
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

    this.editedImage.TempUpdateSize(width, height);

    this.applyChanges();

    this.closeResizeCanvas();

    this.openResizeEditor();
  }

  /**
   * Открыть холст, отображающий реальный размер изображения
   */
  openResizeEditor() {
    this.canvas.removeEventListener("mousedown", this.resizeDownListener);
    this.canvas.removeEventListener("mousemove", this.resizeMoveListener);
    this.canvas.removeEventListener("mouseup", this.resizeUpListener);
    this.canvas.removeEventListener("mouseover", this.resizeOverListener);

    this.canvas.style.cursor = "grab";

    this.canvas.width = this.editedImage.size.width;
    this.canvas.style.width = this.editedImage.size.width + "px";

    this.canvas.height = this.editedImage.size.height;
    this.canvas.style.height = this.editedImage.size.height + "px";

    let _x: number = -(this.editedImage.size.width - this.canvas.width) / 2;
    let _y: number = -(this.editedImage.size.height - this.canvas.height) / 2;

    // Выравнивание
    if (this.editedImage.size.width >= this.max_width) {
      this.canvas.width = this.max_width;
      this.canvas.style.width = this.max_width + "px";

      _x = 0;
    }

    if (this.editedImage.size.height >= this.max_height) {
      this.canvas.height = this.max_height;
      this.canvas.style.height = this.max_height + "px";

      _y = 0;
    }

    this.start_position = { x: _x, y: _y };
    this.distance = { x: 0, y: 0 };

    if (this.context !== null) {
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      if (
        this.currentImage.width > this.canvas.width ||
        this.currentImage.height > this.canvas.height
      ) {
        this.context.drawImage(
          this.editedImage.current,
          _x,
          _y,
          this.editedImage.current.width,
          this.editedImage.current.height,
        );
      } else {
        this.context.drawImage(
          this.currentImage,
          _x,
          _y,
          this.currentImage.width,
          this.currentImage.height,
        );
      }
    }

    this.resizeDownListener = this.handleResizeMouseDown.bind(this);
    this.resizeMoveListener = this.handleResizeMouseMove.bind(this);
    this.resizeUpListener = this.handleResizeMouseUp.bind(this);
    this.resizeOverListener = this.handleResizeMouseOver.bind(this);

    this.canvas.addEventListener("mousedown", this.resizeDownListener);
    this.canvas.addEventListener("mousemove", this.resizeMoveListener);
    this.canvas.addEventListener("mouseup", this.resizeUpListener);
    this.canvas.addEventListener("mouseover", this.resizeOverListener);
  }

  /**
   * Перемещение холста, отображающего реальный размер изображения
   * @param _x {number} - смещение по X
   * @param _y {number} - смещение по Y
   */
  moveCanvas(_x: number, _y: number) {
    this.distance.x = _x - this.start_point.x;
    this.distance.y = _y - this.start_point.y;

    let x = this.start_position.x + this.distance.x;
    let y = this.start_position.y + this.distance.y;

    if (this.currentImage.width >= this.max_width) {
      if (x > 0) x = 0;
      if (x + this.currentImage.width < this.max_width)
        x = this.max_width - this.currentImage.width;
    } else {
      x = -(this.editedImage.size.width - this.canvas.width) / 2;
    }

    if (this.currentImage.height >= this.max_height) {
      if (y > 0) y = 0;
      if (y + this.currentImage.height < this.max_height)
        y = this.max_height - this.currentImage.height;
    } else {
      y = -(this.editedImage.size.height - this.canvas.height) / 2;
    }

    if (
      this.editedImage.size.width > this.canvas.width ||
      this.editedImage.size.height > this.canvas.height
    ) {
      if (this.context !== null) {
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.context.drawImage(
          this.currentImage,
          x,
          y,
          this.currentImage.width,
          this.currentImage.height,
        );
      }
    }
  }

  /**
   * Убрать холст, отображающий реальный размер изображения
   */
  closeResizeCanvas() {
    this.distance = { x: 0, y: 0 };
    this.start_point = { x: 0, y: 0 };
    this.start_position = { x: 0, y: 0 };

    this.canvas.removeEventListener("mousedown", this.resizeDownListener);
    this.canvas.removeEventListener("mousemove", this.resizeMoveListener);
    this.canvas.removeEventListener("mouseup", this.resizeUpListener);
    this.canvas.removeEventListener("mouseover", this.resizeOverListener);
    this.canvas.style.cursor = "default";
  }

  /**
   * Отслеживание нажатия ЛКМ на холсте
   * @param e {MouseEvent}
   */
  handleResizeMouseDown(e: MouseEvent) {
    this.is_on_canvas = true;
    this.distance = { x: 0, y: 0 };
    this.start_point = { x: e.offsetX, y: e.offsetY };
    this.canvas.style.cursor = "grabbing";
  }

  /**
   * Отслеживание перемещения мышки по холсту
   * @param e {MouseEvent}
   */
  handleResizeMouseMove(e: MouseEvent) {
    if (this.is_on_canvas) {
      this.moveCanvas(e.offsetX, e.offsetY);
    }
  }

  /**
   * Отслеживание отжатия ЛКМ на холсте
   */
  handleResizeMouseUp() {
    this.canvas.style.cursor = "grab";

    this.start_position = {
      x: this.start_position.x + this.distance.x,
      y: this.start_position.y + this.distance.y,
    };

    // Отследить, что изображение не вышло за границы области
    if (this.start_position.x > 0) {
      this.start_position.x = 0;
    }
    if (this.start_position.x < this.max_width - this.editedImage.size.width) {
      this.start_position.x = this.max_width - this.editedImage.size.width;
    }

    if (this.start_position.y > 0) {
      this.start_position.y = 0;
    }
    if (this.start_position.y < this.max_height - this.editedImage.size.height) {
      this.start_position.y = this.max_height - this.editedImage.size.height;
    }

    this.is_on_canvas = false;
  }

  /**
   * Отслеживание ухода курсора из области canvas
   */
  handleResizeMouseOver() {
    this.canvas.style.cursor = "grab";
    this.is_on_canvas = false;
    this.start_position = {
      x: this.start_position.x + this.distance.x,
      y: this.start_position.y + this.distance.y,
    };
  }

  /**
   * Поворот изоражения
   * @param angle {number} - угол поворота
   */
  turn(angle: number) {
    if (this.context !== null) {
      this.context.save();

      const image_scale = this.canvas.width / this.canvas.height;

      this.canvas.width = this.canvas.height / image_scale;
      this.canvas.style.width = this.canvas.height / image_scale + "px";

      // Очистка холста
      this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      // Перенос начала координат в центр холста
      this.context.translate(this.canvas.width / 2, this.canvas.height / 2);

      // Поворот вокруг начала координат
      this.context.rotate((angle * Math.PI) / 180);

      this.scale = Math.min(
        this.canvas.width / this.currentImage.width,
        this.canvas.height / this.currentImage.height,
      );

      // Перенос изменённого изображения на холст
      this.context.drawImage(
        this.currentImage,
        -this.canvas.height / 2,
        -this.canvas.width / 2,
        this.canvas.height,
        this.canvas.width,
      );

      this.context.setTransform(1, 0, 0, 1, 0, 0);
      this.context.restore();

      this.editedImage.updateAngle(angle);
      this.applyChanges();
    }
  }

  /**
   * Открыть рамку для обрезки изображения
   */
  openCutFrame() {
    // Создание области обрезки
    this.canvas_area = document.createElement("div");
    this.canvas_area.id = "canvas-area";
    this.canvas_area.classList.add("canvas-area");

    this.currentFrame = new Frame(
      this.canvas.width,
      this.canvas.height,
      this.canvas_area,
    );

    this.canvas_area.style.width = this.canvas.width + "px";
    this.canvas_area.style.height = this.canvas.height + "px";

    this.canvas_area.style.backgroundColor = "rgba(0,0,0,0.0)";
    this.canvas_area.style.position = "absolute";
    this.canvas_area.style.padding = "0";

    this.canvas_area.append(this.currentFrame.HTMLFrameElement);
    this.cutListener = this.cutFrameMoveListener.bind(this);

    document.addEventListener("mousemove", this.cutListener);

    this.canvas_area.addEventListener("mouseover", () => {
      this.currentFrame.is_out = false;
    });

    this.canvas_area.addEventListener("mouseout", () => {
      this.currentFrame.is_out = true;
    });

    document.addEventListener("mouseup", () => (this.currentFrame.current_point = 0));
  }

  /**
   * Отслеживание перемещения рамки обрезки
   * @param e {MouseEvent}
   */
  cutFrameMoveListener(e: MouseEvent) {
    // Если позиция управляющих точек изменилась - нарисовать новое обрезанное изображение

    if (this.currentFrame.handleMouseMove(e)) {
      this.drawCroppedImage(
        this.currentFrame.left_edge,
        this.currentFrame.top_edge,
        this.currentFrame.right_edge,
        this.currentFrame.bottom_edge,
      );
    }
  }

  /**
   * Изменение пропорции обрезки (пока не используется)
   * @param proportion {string} - название пропорции
   */
  changeCutProportion(proportion: string) {
    this.currentFrame.changeProportion(proportion);
    this.drawCroppedImage(
      this.currentFrame.left_edge,
      this.currentFrame.top_edge,
      this.currentFrame.right_edge,
      this.currentFrame.bottom_edge,
    );
  }

  /**
   * Отрисовка обрезки изображения
   * @param _l {number} - Левая граница
   * @param _t {number} - Верхняя граница
   * @param _r {number} - Правая граница
   * @param _b {number} - Нижнаяя граница
   */
  drawCroppedImage(_l: number, _t: number, _r: number, _b: number) {
    if (this.context !== null) {
      this.redraw();
      this.context.fillStyle = "rgba(0,0,0,0.5)";
      this.context.fillRect(0, 0, this.canvas.width, this.canvas.height);

      const width = this.canvas.width - _r - _l;
      const height = this.canvas.height - _b - _t;

      this.cropping(_l + 1, _t + 1, width - 2, height - 2);
    }
  }

  /**
   * Обрезка изображения
   * @param _x {number} - Начальная координата по Х
   * @param _y {number} - Начальная координата по Y
   * @param _width {number} - Ширина
   * @param _height {number} - Высота
   */
  cropping(_x: number, _y: number, _width: number, _height: number) {
    if (this.context !== null) {
      this.context.drawImage(
        this.currentImage,
        _x / this.editedImage.scale,
        _y / this.editedImage.scale,
        _width / this.editedImage.scale,
        _height / this.editedImage.scale,
        _x,
        _y,
        _width,
        _height,
      );
    }
  }

  /**
   * Сохранение обрезанного изображения
   * @param _l {number} - Левая граница
   * @param _t {number} - Верхняя граница
   * @param _r {number} - Правая граница
   * @param _b {number} - Нижняя граница
   */
  saveCropping(_l: number, _t: number, _r: number, _b: number) {
    const _x = _l;
    const _y = _t;
    const _width = this.canvas.width - _r - _l;
    const _height = this.canvas.height - _b - _t;

    if (!(this.canvas.width == _width && this.canvas.height == _height)) {
      if (this.context !== null)
        this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

      this.canvas.width = _width;
      this.canvas.height = _height;

      this.canvas.style.width = _width + "px";
      this.canvas.style.height = _height + "px";

      this.editedImage.updateCrop(_x, _y, _width, _height);

      this.canvas_area.style.cursor = "auto";
      this.image_canvas_box.style.cursor = "auto";
      for (let i = 0; i < 8; i++) {
        this.currentFrame.points[i]!.style.cursor = "auto";
      }
      this.applyChanges();
    }

    this.closeCutFrame();
    this.redraw();
  }

  /**
   * Закрытие рамки обрезки
   */
  closeCutFrame() {
    if (this.canvas_area !== null && this.image_canvas_box !== null) {
      this.image_canvas_box.removeChild(this.canvas_area);
      document.removeEventListener("mousemove", this.cutListener);
      document.removeEventListener(
        "mouseup",
        () => (this.currentFrame.current_point = 0),
      );
    }
  }

  /**
   * Перерисовка холста
   */
  redraw() {
    if (this.context !== null) {
      if (this.current_editor !== "size") {
        this.currentImage = this.editedImage.current;

        if (
          this.currentImage.width > this.max_width ||
          this.currentImage.height > this.max_height
        ) {
          // Расчёт масштаба
          this.scale = this.editedImage.scale;

          // Расчёт новых размеров для холста с учётом масштаба
          const scaledWidth = Math.round(this.currentImage.width * this.scale);
          const scaledHeight = Math.round(this.currentImage.height * this.scale);

          // Изменение размера холста
          this.canvas.width = scaledWidth;
          this.canvas.height = scaledHeight;
          this.canvas.style.width = scaledWidth + "px";
          this.canvas.style.height = scaledHeight + "px";

          // Очистить холст перед размещением изображения
          this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

          // Поместить изображение на холст
          this.context.drawImage(this.currentImage, 0, 0, scaledWidth, scaledHeight);
        } else {
          this.scale = 1;

          // Изменение размера холста
          this.canvas.width = this.currentImage.width;
          this.canvas.height = this.currentImage.height;
          this.canvas.style.width = this.currentImage.width + "px";
          this.canvas.style.height = this.currentImage.height + "px";

          // Очистить холст перед размещением изображения
          this.context.clearRect(0, 0, this.canvas.width, this.canvas.height);

          // Поместить изображение на холст
          this.context.drawImage(
            this.currentImage,
            0,
            0,
            this.currentImage.width,
            this.currentImage.height,
          );
        }
      } else {
        this.openResizeEditor();
      }
    }
  }

  /**
   * Отслеживание нажатия ЛКМ на холсте
   * @param e {MouseEvent}
   */
  handleMouseDown(e: MouseEvent) {
    if (this.currentAnnotation.mode === "draw") {
      this.is_set_start_point = true;
      if (!this.currentAnnotation.is_click_mode) {
        this.currentAnnotation.setStartPoint(e);
      }
    } else if (this.currentAnnotation.mode === "edit") {
      this.currentAnnotation.detectPoint(e);
    }
  }

  /**
   * Отслеживание перемещения мышки по холсту
   * @param e {MouseEvent}
   */
  handleMouseMove(e: MouseEvent) {
    if (
      this.currentAnnotation.mode === "draw" &&
      !this.currentAnnotation.is_click_mode
    ) {
      this.currentAnnotation.moveEndPoint(e);
      this.drawAnnotation();
    } else if (this.currentAnnotation.mode === "edit") {
      if (this.currentAnnotation instanceof RectangleAnnotation) {
        this.currentAnnotation.moveDetectPoint(e);

        switch (this.currentAnnotation.point) {
          case "start":
            if (!this.currentAnnotation.invert)
              this.canvas.style.cursor = "nesw-resize";
            else this.canvas.style.cursor = "nwse-resize";
            break;

          case "left_top":
            if (!this.currentAnnotation.invert)
              this.canvas.style.cursor = "nwse-resize";
            else this.canvas.style.cursor = "nesw-resize";
            break;

          case "right_bottom":
            if (!this.currentAnnotation.invert)
              this.canvas.style.cursor = "nwse-resize";
            else this.canvas.style.cursor = "nesw-resize";
            break;

          case "end":
            if (!this.currentAnnotation.invert)
              this.canvas.style.cursor = "nesw-resize";
            else this.canvas.style.cursor = "nwse-resize";
            break;
        }

        if (this.currentAnnotation.is_none_point) this.canvas.style.cursor = "auto";
      }

      if (this.currentAnnotation.point !== "") {
        if (e.buttons !== 1) return;

        this.currentAnnotation.calculatePosition(e);
        this.drawAnnotation();
      }
    }
  }

  /**
   * Отслеживание отжатия ЛКМ на холсте
   * @param e {MouseEvent}
   */
  handleMouseUp(e: MouseEvent) {
    if (this.currentAnnotation.mode === "draw") {
      if (
        this.currentAnnotation.start.x === e.offsetX &&
        this.currentAnnotation.start.y === e.offsetY
      ) {
        this.currentAnnotation.setStartPoint(e);
        this.currentAnnotation.is_click_mode = true;
      } else {
        this.currentAnnotation.moveEndPoint(e);
        this.currentAnnotation.setEndPoint(e);

        if (this.currentAnnotation instanceof TextAnnotation) {
          this.redraw();
          this.currentAnnotation.openTextAnnotationFrame();
          this.removeAnnotationListeners();
        } else {
          this.drawAnnotation();
          this.currentAnnotation.drawPoints();
        }

        this.currentAnnotation.mode = "edit";
      }
    } else if (
      this.currentAnnotation.mode === "edit" &&
      !(this.currentAnnotation instanceof TextAnnotation)
    ) {
      if (this.currentAnnotation.point !== "") {
        this.currentAnnotation.calculatePosition(e);
        this.drawAnnotation();
        this.currentAnnotation.point = "";
      }
    }
  }

  /**
   * Отслеживание ухода курсора из области canvas во время рисования аннотации
   */
  handleMouseLeave() {
    this.is_on_canvas = false;
  }

  /**
   * Отслеживание возвращение курсора в область canvas во время рисования аннотации
   */
  handleMouseOver() {
    this.is_on_canvas = true;
  }

  /**
   * Отслеживание отжатия ЛКМ вне холста холсте
   */
  handleOutCanvasMouseUp() {
    if (
      !this.currentAnnotation.is_click_mode &&
      !this.is_on_canvas &&
      this.currentAnnotation.mode === "draw" &&
      this.is_set_start_point
    ) {
      if (this.currentAnnotation instanceof TextAnnotation) {
        this.redraw();
        this.currentAnnotation.openTextAnnotationFrame();
        this.removeAnnotationListeners();

        this.currentAnnotation.mode = "edit";
        this.currentAnnotation.point = "";
      } else {
        this.drawAnnotation();
        this.currentAnnotation.drawPoints();
        this.currentAnnotation.mode = "edit";
        this.currentAnnotation.point = "";
      }
    }
  }

  /**
   * Добавить анностацию в imageEditorCanvas
   * @param annotation
   */
  addAnnotation(annotation: Annotation): void {
    if (this.context !== null) {
      annotation.context = this.context;
      this.currentAnnotation = annotation;

      this.AnnotationMouseDownListener = this.handleMouseDown.bind(this);
      this.AnnotationMouseMoveListener = this.handleMouseMove.bind(this);
      this.AnnotationMouseUpListener = this.handleMouseUp.bind(this);

      this.AnnotationOutCanvasMouseUpListener = this.handleOutCanvasMouseUp.bind(this);
      this.AnnotationMouseOverListener = this.handleMouseOver.bind(this);
      this.AnnotationMouseLeaveListener = this.handleMouseLeave.bind(this);

      this.onDelListener = this.onDelHandler.bind(this);

      document.addEventListener("mouseup", this.AnnotationOutCanvasMouseUpListener);
      document.addEventListener("keydown", this.onDelListener);

      if (annotation instanceof TextAnnotation) {
        // Создание области расположения текста
        this.canvas_area = annotation.canvas_area;

        this.canvas_area.addEventListener(
          "mousedown",
          this.AnnotationMouseDownListener,
        );
        this.canvas_area.addEventListener(
          "mousemove",
          this.AnnotationMouseMoveListener,
        );
        this.canvas_area.addEventListener("mouseup", this.AnnotationMouseUpListener);

        this.canvas_area.addEventListener(
          "mouseleave",
          this.AnnotationMouseLeaveListener,
        );
        this.canvas_area.addEventListener(
          "mouseover",
          this.AnnotationMouseOverListener,
        );
      } else {
        this.canvas.addEventListener("mousedown", this.AnnotationMouseDownListener);
        this.canvas.addEventListener("mousemove", this.AnnotationMouseMoveListener);
        this.canvas.addEventListener("mouseup", this.AnnotationMouseUpListener);

        this.canvas.addEventListener("mouseleave", this.AnnotationMouseLeaveListener);
        this.canvas.addEventListener("mouseover", this.AnnotationMouseOverListener);
      }
    }
  }

  /**
   * Отслеживание удаления аннотации
   * @param event {KeyboardEvent}
   */
  onDelHandler(event: KeyboardEvent) {
    if (event.key === "Delete") {
      this.clearAnnotation();
    }
  }

  /**
   * Отрисовка аннотации на холсте
   */
  drawAnnotation() {
    this.redraw();

    if (
      !(
        this.currentAnnotation.mode === "edit" &&
        this.currentAnnotation instanceof TextAnnotation
      )
    )
      this.currentAnnotation.draw();
    if (
      this.currentAnnotation.mode === "edit" &&
      !(this.currentAnnotation instanceof TextAnnotation)
    )
      this.currentAnnotation.drawPoints();
  }

  /**
   * Сохранение аннотации
   */
  saveAnnotation() {
    if (this.currentAnnotation instanceof TextAnnotation) {
      this.editedImage.updateTextAnnotation(this.currentAnnotation);

      if (this.currentAnnotation instanceof TextAnnotation) {
        this.currentAnnotation.closeTextAnnotationFrame();

        this.redraw();
      }
    } else {
      this.currentAnnotation.draw();
      this.editedImage.updateAnnotation(this.currentAnnotation);
    }

    this.applyChanges();
    this.removeAnnotationListeners();

    document.removeEventListener("keydown", this.onDelListener);
  }

  /**
   * Удалить аннотацию.
   */
  removeAnnotation() {
    this.redraw();
    this.removeAnnotationListeners();
  }

  /**
   * Убрать слушатели событий аннотации
   */
  removeAnnotationListeners() {
    this.canvas.removeEventListener("mousedown", this.AnnotationMouseDownListener);
    this.canvas.removeEventListener("mousemove", this.AnnotationMouseMoveListener);
    this.canvas.removeEventListener("mouseup", this.AnnotationMouseUpListener);
    this.canvas.removeEventListener("mouseleave", this.AnnotationMouseLeaveListener);
    this.canvas.removeEventListener("mouseover", this.AnnotationMouseOverListener);

    this.canvas.style.cursor = "auto";
    this.is_set_start_point = false;
  }

  /**
   * Очистить нарисованную аннотацию.
   */
  clearAnnotation() {
    this.is_set_start_point = false;

    this.currentAnnotation.mode = "draw";
    this.currentAnnotation.start.x = -1;
    this.currentAnnotation.start.y = -1;
    this.currentAnnotation.end.x = -1;
    this.currentAnnotation.end.y = -1;
    this.currentAnnotation.is_click_mode = false;

    if (this.currentAnnotation instanceof TextAnnotation) {
      this.currentAnnotation.closeTextAnnotationFrame();

      this.canvas_area = document.createElement("div");
      this.canvas_area.id = "canvas-area";

      this.canvas_area.addEventListener("mousedown", this.AnnotationMouseDownListener);
      this.canvas_area.addEventListener("mousemove", this.AnnotationMouseMoveListener);
      this.canvas_area.addEventListener("mouseup", this.AnnotationMouseUpListener);

      this.canvas_area.addEventListener(
        "mouseleave",
        this.AnnotationMouseLeaveListener,
      );
      this.canvas_area.addEventListener("mouseover", this.AnnotationMouseOverListener);

      this.currentAnnotation.canvas_area = this.canvas_area;

      this.currentAnnotation.reopenTextAnnotationFrame();
    }

    this.redraw();
    this.canvas.style.cursor = "default";
  }

  /**
   * Применить изменения
   */
  applyChanges() {
    this.is_undo_inactive = false;
  }
}