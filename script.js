import fs from "fs"

function mapFontSize(size) {
  if (size <= 16) return 14;
  if (size <= 21) return 18;
  if (size <= 26) return 24;
  return 32;
}

function mapThickness(strokeWidth) {
  if (strokeWidth <= 2) return 1;
  if (strokeWidth <= 4) return 2;
  if (strokeWidth <= 6) return 3;
  if (strokeWidth <= 8) return 4;
  return 5;
}

function isHighlighter(obj) {
  if (!obj.stroke) return false;

  // Detect rgba with alpha < 1
  const match = obj.stroke.match(/rgba?\(([^)]+)\)/);
  if (!match) return false;

  const parts = match[1].split(",").map(Number);

  // rgba => 4 values, last is alpha
  if (parts.length === 4 && parts[3] < 1) return true;

  // fallback: very thick stroke
  if (obj.strokeWidth >= 15) return true;

  return false;
}


function colorToArgbNumber(color) {
  if (!color) return undefined;

  // HEX
  if (color.startsWith("#")) {
    let hex = color.replace("#", "");

    if (hex.length === 3) {
      hex = hex.split("").map(c => c + c).join("");
    }

    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);
    const a = 255;

    return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
  }

  // RGBA / RGB
  const match = color.match(/rgba?\(([^)]+)\)/);
  if (match) {
    const parts = match[1].split(",").map(Number);

    const r = parts[0];
    const g = parts[1];
    const b = parts[2];
    const a = parts.length === 4 ? Math.round(parts[3] * 255) : 255;

    return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
  }

  return undefined;
}


function fabricToQuillDelta(fabricJson) {
  const result = [];

  fabricJson.objects.forEach((obj, index) => {

    if (obj.type === "rect") {
      const width = (obj.width || 0) * (obj.scaleX || 1);
      const height = (obj.height || 0) * (obj.scaleY || 1);

      const isSquare = Math.abs(width - height) < 0.01; // tolerance for float

      // ✅ COMMON fields
      const baseShape = {
        id: obj.id || crypto.randomUUID(),
        position: {
          dx: obj.left || 0,
          dy: obj.top || 0,
        },
        color: colorToArgbNumber(obj.stroke || obj.fill),
        rotation: obj.angle || 0,
        thickness: obj.strokeWidth
          ? mapThickness(obj.strokeWidth)
          : 0,
        isFilled: !!obj.fill,
      };

      // ✅ SQUARE
      if (isSquare) {
        result.push({
          ...baseShape,
          shapeType: "square",
          sideLength: width, // same as height
          type: "square",
        });
      }
      // ✅ RECTANGLE
      else {
        result.push({
          ...baseShape,
          shapeType: "rectangle",
          rect: {
            left: obj.left || 0,
            top: obj.top || 0,
            width,
            height,
          },
          type: "rectangle",
        });
      }

      return; // ⛔ skip text logic
    }

    //CIRCLE
    if (obj.type === "circle") {
      const scaleX = obj.scaleX || 1;
      const scaleY = obj.scaleY || 1;

      // Use average scale to avoid distortion issues
      const avgScale = (scaleX + scaleY) / 2;

      const radius = (obj.radius || 0) * avgScale;
      const width = radius * 2;
      const height = radius * 2;

      const baseShape = {
        id: obj.id || crypto.randomUUID(),
        position: {
          dx: obj.left - obj.radius || 0,
          dy: obj.top - obj.radius || 0,
        },
        color: colorToArgbNumber(obj.stroke || obj.fill),
        rotation: obj.angle || 0,
        thickness: obj.strokeWidth
          ? mapThickness(obj.strokeWidth)
          : 0,
        isFilled: !!obj.fill,
      };

      result.push({
        ...baseShape,
        shapeType: "circle",
        radius,
        width,
        height,
        type: "circle",
      });

      return; // ⛔ skip text logic
    }


    // ELLIPSE (→ OVAL)
    if (obj.type === "ellipse") {
      const scaleX = obj.scaleX || 1;
      const scaleY = obj.scaleY || 1;

      const rx = (obj.rx || 0) * scaleX;
      const ry = (obj.ry || 0) * scaleY;

      const width = rx * 2;
      const height = ry * 2;

      const baseShape = {
        id: obj.id || crypto.randomUUID(),
        position: {
          dx: obj.left || 0,
          dy: obj.top || 0,
        },
        color: colorToArgbNumber(obj.stroke || obj.fill),
        rotation: obj.angle || 0,
        thickness: obj.strokeWidth
          ? mapThickness(obj.strokeWidth)
          : 0,
        isFilled: !!obj.fill,
      };

      result.push({
        ...baseShape,
        shapeType: "oval",
        rect: {
          left: obj.left || 0,
          top: obj.top || 0,
          width,
          height,
        },
        type: "oval",
      });

      return; // ⛔ skip text logic
    }

    // LINE (→ VERTICAL + HORIZONTAL + ANGLED)
    if (obj.type === "line") {
      const scaleX = obj.scaleX || 1;
      const scaleY = obj.scaleY || 1;

      const x1 = (obj.x1 || 0) * scaleX;
      const x2 = (obj.x2 || 0) * scaleX;
      const y1 = (obj.y1 || 0) * scaleY;
      const y2 = (obj.y2 || 0) * scaleY;

      const isVertical = Math.abs(x1 - x2) < 0.01;
      const isHorizontal = Math.abs(y1 - y2) < 0.01;

      const centerX = obj.left || 0;
      const centerY = obj.top || 0;

      // ✅ VERTICAL
      if (isVertical) {
        const halfHeight = Math.abs(y2 - y1) / 2;
        const startDy = centerY - halfHeight;
        const endDy = centerY + halfHeight;

        result.push({
          id: obj.id || crypto.randomUUID(),
          position: { dx: centerX, dy: startDy },
          start: { dx: centerX, dy: startDy },
          end: { dx: centerX, dy: endDy },
          color: colorToArgbNumber(obj.stroke),
          rotation: obj.angle || 0,
          thickness: obj.strokeWidth ? mapThickness(obj.strokeWidth) : 0,
          type: "verticalLine",
        });
      }

      // ✅ HORIZONTAL
      else if (isHorizontal) {
        const halfWidth = Math.abs(x2 - x1) / 2;
        const startDx = centerX - halfWidth;
        const endDx = centerX + halfWidth;

        result.push({
          id: obj.id || crypto.randomUUID(),
          position: { dx: startDx, dy: centerY },
          start: { dx: startDx, dy: centerY },
          end: { dx: endDx, dy: centerY },
          color: colorToArgbNumber(obj.stroke),
          rotation: obj.angle || 0,
          thickness: obj.strokeWidth ? mapThickness(obj.strokeWidth) : 0,
          type: "horizontalLine",
        });
      }

      // ✅ ANGLED LINE (NEW)
      else {
        const startDx = centerX + x1;
        const startDy = centerY + y1;
        const endDx = centerX + x2;
        const endDy = centerY + y2;

        result.push({
          id: obj.id || crypto.randomUUID(),
          position: {
            dx: Math.min(startDx, endDx), // top-left of bounding box
            dy: Math.min(startDy, endDy),
          },
          start: { dx: startDx, dy: startDy },
          end: { dx: endDx, dy: endDy },
          color: colorToArgbNumber(obj.stroke),
          rotation: obj.angle || 0,
          thickness: obj.strokeWidth ? mapThickness(obj.strokeWidth) : 0,
          type: "angledLine",
        });
      }

      return;
    }


    // ✏️ PENCIL / 🖍️ HIGHLIGHTER
    if (obj.type === "path") {
      const points = [];

      let currentX = 0;
      let currentY = 0;

      const STEPS = 10;

      obj.path.forEach((segment) => {
        const cmd = segment[0];

        if (cmd === "M") {
          currentX = segment[1];
          currentY = segment[2];

          points.push({ dx: currentX, dy: currentY });
        }

        else if (cmd === "L") {
          const x = segment[1];
          const y = segment[2];

          points.push({ dx: x, dy: y });

          currentX = x;
          currentY = y;
        }

        else if (cmd === "Q") {
          const cx = segment[1];
          const cy = segment[2];
          const x = segment[3];
          const y = segment[4];

          for (let t = 0; t <= 1; t += 1 / STEPS) {
            const xt =
              (1 - t) * (1 - t) * currentX +
              2 * (1 - t) * t * cx +
              t * t * x;

            const yt =
              (1 - t) * (1 - t) * currentY +
              2 * (1 - t) * t * cy +
              t * t * y;

            points.push({ dx: xt, dy: yt });
          }

          currentX = x;
          currentY = y;
        }

        else if (cmd === "C") {
          const cx1 = segment[1];
          const cy1 = segment[2];
          const cx2 = segment[3];
          const cy2 = segment[4];
          const x = segment[5];
          const y = segment[6];

          for (let t = 0; t <= 1; t += 1 / STEPS) {
            const xt =
              Math.pow(1 - t, 3) * currentX +
              3 * Math.pow(1 - t, 2) * t * cx1 +
              3 * (1 - t) * t * t * cx2 +
              t * t * t * x;

            const yt =
              Math.pow(1 - t, 3) * currentY +
              3 * Math.pow(1 - t, 2) * t * cy1 +
              3 * (1 - t) * t * t * cy2 +
              t * t * t * y;

            points.push({ dx: xt, dy: yt });
          }

          currentX = x;
          currentY = y;
        }
      });

      if (!points.length) return;

      const isHL = isHighlighter(obj);

      result.push({
        id: obj.id || crypto.randomUUID(),

        drawPoints: points,

        paint: isHL
          ? {
            color: colorToArgbNumber(obj.stroke),
            strokeWidth: obj.strokeWidth || 1,
          }
          : {
            color: colorToArgbNumber(obj.stroke),
            strokeWidth: obj.strokeWidth || 1,
            style: 1,
            strokeCap: obj.strokeLineCap === "round" ? 1 : 0,
          },

        position: {
          dx: points[0].dx,
          dy: points[0].dy,
        },

        type: isHL ? "highlighter" : "pencil",
      });

      return;
    }

    if (!obj.text) return;

    const text = obj.text;
    const length = text.length;

    // Step 1: Create style map for each character
    const charStyles = Array.from({ length }, () => ({}));

    // Base styles (apply to all)
    const baseStyle = {
      bold: obj.fontWeight === "bold" ? true : undefined,
      italic: obj.fontStyle === "italic" ? true : undefined,
      underline: obj.underline || undefined,
      color: obj.fill || undefined,
      size: obj.fontSize ? mapFontSize(obj.fontSize) : undefined,
      font: obj.fontFamily || undefined,
    };

    // Apply base styles
    for (let i = 0; i < length; i++) {
      charStyles[i] = { ...baseStyle };
    }

    // Step 2: Apply Fabric range styles
    if (Array.isArray(obj.styles)) {
      obj.styles.forEach(({ start, end, style }) => {
        for (let i = start; i < end; i++) {
          if (!charStyles[i]) continue;

          if (style.fill) charStyles[i].color = style.fill;
          if (style.fontWeight === "bold") charStyles[i].bold = true;
          if (style.fontStyle === "italic") charStyles[i].italic = true;
          if (style.fontSize) charStyles[i].size = mapFontSize(style.fontSize);
          if (style.underline) charStyles[i].underline = true;
        }
      });
    }

    // Step 3: Convert to Delta ops (merge same-style runs)
    let ops = [];
    let currentText = text[0];
    let currentStyle = charStyles[0];

    const isSameStyle = (a, b) =>
      JSON.stringify(a) === JSON.stringify(b);

    for (let i = 1; i < length; i++) {
      if (isSameStyle(currentStyle, charStyles[i])) {
        currentText += text[i];
      } else {
        ops.push({
          insert: currentText,
          attributes: cleanAttributes(currentStyle),
        });
        currentText = text[i];
        currentStyle = charStyles[i];
      }
    }

    // Push last chunk
    ops.push({
      insert: currentText,
      attributes: cleanAttributes(currentStyle),
    });

    // Add newline (Quill requirement)
    ops.push({ insert: "\n" });

    result.push({
      id: obj.id || crypto.randomUUID(),
      position: {
        dx: obj.left || 0,
        dy: obj.top || 0,
      },
      documentJson: ops,
      width: obj.width,
      height: obj.height,
      textAlign: obj.textAlign || "left",
      type: "richText",
      ...(obj.angle !== undefined && obj.angle !== 0 && { angle: obj.angle }),
    });
  });

  return {
    timestamp: new Date().toISOString(),
    sessionId: "generated",
    items: result,
  };
}

// Remove undefined values (important for Quill)
function cleanAttributes(attr) {
  const cleaned = {};
  Object.keys(attr).forEach((key) => {
    if (attr[key] !== undefined && attr[key] !== null) {
      cleaned[key] = attr[key];
    }
  });
  return Object.keys(cleaned).length ? cleaned : undefined;
}


const fabricData = {"version":"3.6.3","objects":[{"type":"group","version":"3.6.3","originX":"left","originY":"top","left":0,"top":0,"width":0,"height":0,"fill":"rgb(0,0,0)","stroke":null,"strokeWidth":0,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"dontMakeSelectable":true,"id":"objectGroup","groupable":false,"objectCaching":false,"objects":[]},{"type":"line","version":"3.6.3","originX":"center","originY":"center","left":666,"top":273.5,"width":0,"height":151,"fill":"rgb(0,0,0)","stroke":"#ff0000","strokeWidth":1,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1776145003781","objectCaching":true,"x1":0,"x2":0,"y1":-75.5,"y2":75.5},{"type":"line","version":"3.6.3","originX":"center","originY":"center","left":747.5,"top":261,"width":159,"height":124,"fill":"rgb(0,0,0)","stroke":"#ff0000","strokeWidth":7,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1776145014264","objectCaching":true,"x1":-79.5,"x2":79.5,"y1":-62,"y2":62},{"type":"line","version":"3.6.3","originX":"center","originY":"center","left":718.5,"top":301.5,"width":211,"height":47,"fill":"rgb(0,0,0)","stroke":"#ff0000","strokeWidth":7,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1776145017868","objectCaching":true,"x1":-105.5,"x2":105.5,"y1":-23.5,"y2":23.5},{"type":"line","version":"3.6.3","originX":"center","originY":"center","left":641,"top":309,"width":52,"height":76,"fill":"rgb(0,0,0)","stroke":"#ff0000","strokeWidth":7,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1776145021005","objectCaching":true,"x1":-26,"x2":26,"y1":-38,"y2":38},{"type":"line","version":"3.6.3","originX":"center","originY":"center","left":693,"top":191,"width":154,"height":0,"fill":"rgb(0,0,0)","stroke":"#ff0000","strokeWidth":7,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1776145026995","objectCaching":true,"x1":-77,"x2":77,"y1":0,"y2":0},{"type":"line","version":"3.6.3","originX":"center","originY":"center","left":724,"top":377,"width":148,"height":0,"fill":"rgb(0,0,0)","stroke":"#ff0000","strokeWidth":7,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1776145028827","objectCaching":true,"x1":-74,"x2":74,"y1":0,"y2":0}],"perPixelTargetFind":false,"centeredRotation":false}



// let result = fabricToQuillDelta(fabricData)
// console.log(JSON.stringify(result, null, 2));

const output = fabricToQuillDelta(fabricData)

fs.writeFileSync(
  "whiteboard.json",
  (JSON.stringify(output, null, 2))
);