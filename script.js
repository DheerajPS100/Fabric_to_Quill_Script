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

const fabricData = {"version":"3.6.3","objects":[{"type":"group","version":"3.6.3","originX":"left","originY":"top","left":0,"top":0,"width":0,"height":0,"fill":"rgb(0,0,0)","stroke":null,"strokeWidth":0,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"dontMakeSelectable":true,"id":"objectGroup","groupable":false,"objectCaching":false,"objects":[]},{"type":"ellipse","version":"3.6.3","originX":"left","originY":"top","left":582,"top":147,"width":203,"height":263,"fill":"","stroke":"#474d6c","strokeWidth":6,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"rx":101.5,"ry":131.5,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1775814187365","objectCaching":true},{"type":"circle","version":"3.6.3","originX":"center","originY":"center","left":984,"top":306,"width":121.62,"height":121.62,"fill":"","stroke":"#b1b9e2","strokeWidth":6,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"radius":60.81118318204309,"startAngle":0,"endAngle":6.283185307179586,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1775815716958","objectCaching":true},{"type":"textbox","version":"3.6.3","originX":"left","originY":"top","left":981,"top":167,"width":177.21,"height":33.9,"fill":"#b1b9e2","stroke":null,"strokeWidth":1,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"text":"Oval Shape","fontSize":"30","fontWeight":"normal","fontFamily":"Verdana","fontStyle":"italic","lineHeight":1.16,"underline":true,"overline":false,"linethrough":false,"textAlign":"left","textBackgroundColor":"","charSpacing":0,"minWidth":20,"splitByGrapheme":false,"selectable":false,"perPixelTargetFind":false,"centeredRotation":true,"id":"0binuM0-1775815699535","groupable":false,"objectCaching":true,"styles":{}}],"perPixelTargetFind":false,"centeredRotation":false}


let result = fabricToQuillDelta(fabricData)
console.log(JSON.stringify(result, null, 2));
// console.log(result)