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

function hexToArgbNumber(hex) {
  if (!hex) return undefined;

  // Remove #
  hex = hex.replace("#", "");

  // Convert to full RGB if shorthand
  if (hex.length === 3) {
    hex = hex.split("").map(c => c + c).join("");
  }

  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);

  const a = 255; // fully opaque

  // Convert to ARGB number
  return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
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
        color: hexToArgbNumber(obj.stroke || obj.fill),
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
          dx: obj.left || 0,
          dy: obj.top || 0,
        },
        color: hexToArgbNumber(obj.stroke || obj.fill),
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
        color: hexToArgbNumber(obj.stroke || obj.fill),
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

        result.push({
          id: obj.id || crypto.randomUUID(),
          position: { dx: centerX, dy: centerY },
          start: { dx: centerX, dy: centerY - halfHeight },
          end: { dx: centerX, dy: centerY + halfHeight },
          color: hexToArgbNumber(obj.stroke),
          rotation: obj.angle || 0,
          thickness: obj.strokeWidth ? mapThickness(obj.strokeWidth) : 0,
          type: "verticalLine",
        });
      }

      // ✅ HORIZONTAL
      else if (isHorizontal) {
        const halfWidth = Math.abs(x2 - x1) / 2;

        result.push({
          id: obj.id || crypto.randomUUID(),
          position: { dx: centerX, dy: centerY },
          start: { dx: centerX - halfWidth, dy: centerY },
          end: { dx: centerX + halfWidth, dy: centerY },
          color: hexToArgbNumber(obj.stroke),
          rotation: obj.angle || 0,
          thickness: obj.strokeWidth ? mapThickness(obj.strokeWidth) : 0,
          type: "horizontalLine",
        });
      }

      // ✅ ANGLED LINE (NEW)
      else {
        result.push({
          id: obj.id || crypto.randomUUID(),
          position: { dx: centerX, dy: centerY },

          // 🔥 Key fix: use relative coords from center
          start: {
            dx: centerX + x1,
            dy: centerY + y1,
          },
          end: {
            dx: centerX + x2,
            dy: centerY + y2,
          },

          color: hexToArgbNumber(obj.stroke),
          rotation: obj.angle || 0,
          thickness: obj.strokeWidth ? mapThickness(obj.strokeWidth) : 0,
          type: "angledLine",
        });
      }

      return;
    }


    // ✏️ PENCIL (IMPROVED - CURVE SAMPLING)
    if (obj.type === "path") {
      const points = [];

      const left = obj.left || 0;
      const top = obj.top || 0;

      let currentX = 0;
      let currentY = 0;

      const STEPS = 10; // 🔥 smoothness (increase for better quality)

      obj.path.forEach((segment) => {
        const cmd = segment[0];

        // MOVE
        if (cmd === "M") {
          currentX = segment[1];
          currentY = segment[2];

          points.push({
            dx: currentX,
            dy: currentY,
          });
        }

        // LINE
        else if (cmd === "L") {
          const x = segment[1];
          const y = segment[2];

          points.push({
            dx: x,
            dy: y,
          });

          currentX = x;
          currentY = y;
        }

        // QUADRATIC CURVE
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

            points.push({
              dx: xt,
              dy: yt,
            });
          }

          currentX = x;
          currentY = y;
        }

        // CUBIC CURVE
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

            points.push({
              dx: xt,
              dy: yt,
            });
          }

          currentX = x;
          currentY = y;
        }
      });

      if (!points.length) return;

      result.push({
        id: obj.id || crypto.randomUUID(),

        drawPoints: points,

        paint: {
          color: hexToArgbNumber(obj.stroke),
          strokeWidth: obj.strokeWidth || 1,
          style: 1,
          strokeCap: obj.strokeLineCap === "round" ? 1 : 0,
        },

        position: {
          dx: points[0].dx,
          dy: points[0].dy,
        },

        type: "pencil",
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

const fabricData = {
  "version": "3.6.3",
  "objects": [
    {
      "type": "group",
      "version": "3.6.3",
      "originX": "left",
      "originY": "top",
      "left": 0,
      "top": 0,
      "width": 0,
      "height": 0,
      "fill": "rgb(0,0,0)",
      "stroke": null,
      "strokeWidth": 0,
      "strokeDashArray": null,
      "strokeLineCap": "butt",
      "strokeDashOffset": 0,
      "strokeLineJoin": "miter",
      "strokeMiterLimit": 4,
      "scaleX": 1,
      "scaleY": 1,
      "angle": 0,
      "flipX": false,
      "flipY": false,
      "opacity": 1,
      "shadow": null,
      "visible": true,
      "clipTo": null,
      "backgroundColor": "",
      "fillRule": "nonzero",
      "paintFirst": "fill",
      "globalCompositeOperation": "source-over",
      "transformMatrix": null,
      "skewX": 0,
      "skewY": 0,
      "selectable": false,
      "perPixelTargetFind": true,
      "centeredRotation": true,
      "dontMakeSelectable": true,
      "id": "objectGroup",
      "groupable": false,
      "objectCaching": false,
      "objects": []
    },
    {
      "type": "path",
      "version": "3.6.3",
      "originX": "left",
      "originY": "top",
      "left": 542.13,
      "top": 109,
      "width": 143.88,
      "height": 145,
      "fill": null,
      "stroke": "#904c4c",
      "strokeWidth": 6,
      "strokeDashArray": null,
      "strokeLineCap": "round",
      "strokeDashOffset": 0,
      "strokeLineJoin": "round",
      "strokeMiterLimit": 10,
      "scaleX": 1,
      "scaleY": 1,
      "angle": 0,
      "flipX": false,
      "flipY": false,
      "opacity": 1,
      "shadow": null,
      "visible": true,
      "clipTo": null,
      "backgroundColor": "",
      "fillRule": "nonzero",
      "paintFirst": "fill",
      "globalCompositeOperation": "source-over",
      "transformMatrix": null,
      "skewX": 0,
      "skewY": 0,
      "selectable": false,
      "perPixelTargetFind": true,
      "centeredRotation": true,
      "id": "0binuM0-1776061494776",
      "objectCaching": true,
      "path": [
        ["M", 689.006, 203],
        ["Q", 689, 203, 688.5, 203],
        ["Q", 688, 203, 687, 203],
        ["Q", 686, 203, 684, 203],
        ["Q", 682, 203, 681, 203],
        ["Q", 680, 203, 678, 203],
        ["Q", 676, 203, 674, 203],
        ["Q", 672, 203, 670.5, 203],
        ["Q", 669, 203, 667, 203],
        ["Q", 665, 203, 664.5, 203.5],
        ["Q", 664, 204, 662.5, 204],
        ["Q", 661, 204, 659, 204],
        ["Q", 657, 204, 655.5, 204],
        ["Q", 654, 204, 651.5, 204],
        ["Q", 649, 204, 646.5, 204],
        ["Q", 644, 204, 640.5, 204],
        ["Q", 637, 204, 633.5, 204],
        ["Q", 630, 204, 627.5, 204],
        ["Q", 625, 204, 622.5, 204],
        ["Q", 620, 204, 616, 204],
        ["Q", 612, 204, 609, 204],
        ["Q", 606, 204, 603, 204],
        ["Q", 600, 204, 596, 204],
        ["Q", 592, 204, 589, 204],
        ["Q", 586, 204, 582.5, 204.5],
        ["Q", 579, 205, 575.5, 205],
        ["Q", 572, 205, 570, 205],
        ["Q", 568, 205, 566, 205],
        ["Q", 564, 205, 562, 205.5],
        ["Q", 560, 206, 557, 206],
        ["Q", 554, 206, 553, 206.5],
        ["Q", 552, 207, 550, 207],
        ["Q", 548, 207, 547, 207],
        ["Q", 546, 207, 545.5, 207],
        ["Q", 545, 207, 545.5, 207],
        ["Q", 546, 207, 546.5, 206.5],
        ["Q", 547, 206, 547.5, 205.5],
        ["Q", 548, 205, 548.5, 204],
        ["Q", 549, 203, 549.5, 202.5],
        ["Q", 550, 202, 550, 201.5],
        ["Q", 550, 201, 550.5, 200.5],
        ["Q", 551, 200, 551.5, 198.5],
        ["Q", 552, 197, 552.5, 196],
        ["Q", 553, 195, 554, 194],
        ["Q", 555, 193, 556, 190],
        ["Q", 557, 187, 558.5, 185.5],
        ["Q", 560, 184, 562, 180.5],
        ["Q", 564, 177, 566.5, 175],
        ["Q", 569, 173, 571, 170],
        ["Q", 573, 167, 576, 164],
        ["Q", 579, 161, 581.5, 159],
        ["Q", 584, 157, 587, 155],
        ["Q", 590, 153, 592, 151],
        ["Q", 594, 149, 595.5, 147.5],
        ["Q", 597, 146, 598.5, 145],
        ["Q", 600, 144, 602.5, 142],
        ["Q", 605, 140, 607, 138.5],
        ["Q", 609, 137, 612, 135],
        ["Q", 615, 133, 617.5, 131],
        ["Q", 620, 129, 623, 127],
        ["Q", 626, 125, 628.5, 123],
        ["Q", 631, 121, 633.5, 119.5],
        ["Q", 636, 118, 637.5, 116.5],
        ["Q", 639, 115, 639.5, 114.5],
        ["Q", 640, 114, 641, 113.5],
        ["Q", 642, 113, 642.5, 113],
        ["Q", 643, 113, 643, 112.5],
        ["Q", 643, 112, 643.5, 112],
        ["Q", 644, 112, 644, 112.5],
        ["Q", 644, 113, 644, 113.5],
        ["Q", 644, 114, 644, 114.5],
        ["Q", 644, 115, 644, 116],
        ["Q", 644, 117, 643.5, 118],
        ["Q", 643, 119, 643, 120],
        ["Q", 643, 121, 642.5, 122],
        ["Q", 642, 123, 641.5, 124],
        ["Q", 641, 125, 641, 125.5],
        ["Q", 641, 126, 640.5, 127],
        ["Q", 640, 128, 640, 128.5],
        ["Q", 640, 129, 639.5, 129.5],
        ["Q", 639, 130, 638.5, 131.5],
        ["Q", 638, 133, 637.5, 134],
        ["Q", 637, 135, 636.5, 136],
        ["Q", 636, 137, 635, 139],
        ["Q", 634, 141, 633.5, 142.5],
        ["Q", 633, 144, 632.5, 146.5],
        ["Q", 632, 149, 632, 150.5],
        ["Q", 632, 152, 631.5, 154.5],
        ["Q", 631, 157, 630, 159.5],
        ["Q", 629, 162, 628.5, 164.5],
        ["Q", 628, 167, 628, 169],
        ["Q", 628, 171, 628, 172.5],
        ["Q", 628, 174, 627, 176],
        ["Q", 626, 178, 625.5, 179.5],
        ["Q", 625, 181, 624.5, 183],
        ["Q", 624, 185, 624, 187],
        ["Q", 624, 189, 623, 191],
        ["Q", 622, 193, 621.5, 195],
        ["Q", 621, 197, 620.5, 200],
        ["Q", 620, 203, 620, 205],
        ["Q", 620, 207, 620, 210],
        ["Q", 620, 213, 620, 215.5],
        ["Q", 620, 218, 620, 220],
        ["Q", 620, 222, 620, 223.5],
        ["Q", 620, 225, 620, 227],
        ["Q", 620, 229, 620, 230],
        ["Q", 620, 231, 620, 232],
        ["Q", 620, 233, 620, 234.5],
        ["Q", 620, 236, 620, 237],
        ["Q", 620, 238, 620.5, 239.5],
        ["Q", 621, 241, 621.5, 243],
        ["Q", 622, 245, 622, 245.5],
        ["Q", 622, 246, 622.5, 247.5],
        ["Q", 623, 249, 623.5, 250.5],
        ["Q", 624, 252, 624, 252.5],
        ["Q", 624, 253, 624, 253.5],
        ["Q", 624, 254, 624, 254.5],
        ["Q", 624, 255, 624, 255.5],
        ["Q", 624, 256, 624, 256.5],
        ["Q", 624, 257, 624.5, 257],
        ["L", 625.006, 257]
      ]
    }
  ],
  "perPixelTargetFind": false,
  "centeredRotation": false
}



// let result = fabricToQuillDelta(fabricData)
// console.log(JSON.stringify(result, null, 2));

const output = fabricToQuillDelta(fabricData)

fs.writeFileSync(
  "whiteboard.json",
  JSON.stringify(JSON.stringify(output, null, 2))
);