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

const fabricData = {"version":"3.6.3","objects":[{"type":"group","version":"3.6.3","originX":"left","originY":"top","left":0,"top":0,"width":0,"height":0,"fill":"rgb(0,0,0)","stroke":null,"strokeWidth":0,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"dontMakeSelectable":true,"id":"objectGroup","groupable":false,"objectCaching":false,"objects":[]},{"type":"rect","version":"3.6.3","originX":"left","originY":"top","left":286,"top":265,"width":301,"height":76,"fill":null,"stroke":"#030511","strokeWidth":1,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"rx":0,"ry":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1775820089608","objectCaching":true},{"type":"rect","version":"3.6.3","originX":"left","originY":"top","left":816,"top":225,"width":148,"height":148,"fill":null,"stroke":"#5a8e1a","strokeWidth":5,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"rx":0,"ry":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1775820124901","objectCaching":true},{"type":"circle","version":"3.6.3","originX":"center","originY":"center","left":1160,"top":250,"width":165.47,"height":165.47,"fill":"","stroke":"#5faddd","strokeWidth":5,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"radius":82.73451516749222,"startAngle":0,"endAngle":6.283185307179586,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1775820147265","objectCaching":true},{"type":"ellipse","version":"3.6.3","originX":"left","originY":"top","left":643,"top":492,"width":383,"height":72,"fill":"","stroke":"#a83605","strokeWidth":5,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"rx":191.5,"ry":36,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1775820171528","objectCaching":true},{"type":"line","version":"3.6.3","originX":"center","originY":"center","left":684,"top":222,"width":0,"height":102,"fill":"rgb(0,0,0)","stroke":"#000000","strokeWidth":5,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1775820192711","objectCaching":true,"x1":0,"x2":0,"y1":-51,"y2":51},{"type":"line","version":"3.6.3","originX":"center","originY":"center","left":671.5,"top":135,"width":225,"height":0,"fill":"rgb(0,0,0)","stroke":"#000000","strokeWidth":5,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1775820198270","objectCaching":true,"x1":-112.5,"x2":112.5,"y1":0,"y2":0},{"type":"line","version":"3.6.3","originX":"center","originY":"center","left":751,"top":201,"width":72,"height":112,"fill":"rgb(0,0,0)","stroke":"#000000","strokeWidth":5,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1775820202854","objectCaching":true,"x1":36,"x2":-36,"y1":-56,"y2":56},{"type":"line","version":"3.6.3","originX":"center","originY":"center","left":620,"top":215,"width":96,"height":96,"fill":"rgb(0,0,0)","stroke":"#000000","strokeWidth":5,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"selectable":false,"perPixelTargetFind":true,"centeredRotation":true,"id":"0binuM0-1775820204959","objectCaching":true,"x1":-48,"x2":48,"y1":-48,"y2":48},{"type":"textbox","version":"3.6.3","originX":"left","originY":"top","left":407,"top":293,"width":127.67,"height":24.86,"fill":"#030511","stroke":null,"strokeWidth":1,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"text":"Rectangle","fontSize":"22","fontWeight":"bold","fontFamily":"Verdana","fontStyle":"normal","lineHeight":1.16,"underline":true,"overline":false,"linethrough":false,"textAlign":"left","textBackgroundColor":"","charSpacing":0,"minWidth":20,"splitByGrapheme":false,"selectable":false,"perPixelTargetFind":false,"centeredRotation":true,"id":"0binuM0-1775820094019","groupable":false,"objectCaching":true,"styles":{}},{"type":"textbox","version":"3.6.3","originX":"left","originY":"top","left":823,"top":282,"width":91.93,"height":24.86,"fill":"#5a8e1a","stroke":null,"strokeWidth":1,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"text":"Square","fontSize":"22","fontWeight":"bold","fontFamily":"Verdana","fontStyle":"normal","lineHeight":1.16,"underline":true,"overline":false,"linethrough":false,"textAlign":"left","textBackgroundColor":"","charSpacing":0,"minWidth":20,"splitByGrapheme":false,"selectable":false,"perPixelTargetFind":false,"centeredRotation":true,"id":"0binuM0-1775820130493","groupable":false,"objectCaching":true,"styles":{}},{"type":"textbox","version":"3.6.3","originX":"left","originY":"top","left":1108,"top":249,"width":74.45,"height":24.86,"fill":"#5faddd","stroke":null,"strokeWidth":1,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"text":"Circle","fontSize":"22","fontWeight":"bold","fontFamily":"Verdana","fontStyle":"normal","lineHeight":1.16,"underline":true,"overline":false,"linethrough":false,"textAlign":"left","textBackgroundColor":"","charSpacing":0,"minWidth":20,"splitByGrapheme":false,"selectable":false,"perPixelTargetFind":false,"centeredRotation":true,"id":"0binuM0-1775820153328","groupable":false,"objectCaching":true,"styles":{}},{"type":"textbox","version":"3.6.3","originX":"left","originY":"top","left":720,"top":526,"width":60.21,"height":24.86,"fill":"#a83605","stroke":null,"strokeWidth":1,"strokeDashArray":null,"strokeLineCap":"butt","strokeDashOffset":0,"strokeLineJoin":"miter","strokeMiterLimit":4,"scaleX":1,"scaleY":1,"angle":0,"flipX":false,"flipY":false,"opacity":1,"shadow":null,"visible":true,"clipTo":null,"backgroundColor":"","fillRule":"nonzero","paintFirst":"fill","globalCompositeOperation":"source-over","transformMatrix":null,"skewX":0,"skewY":0,"text":"Oval","fontSize":"22","fontWeight":"bold","fontFamily":"Verdana","fontStyle":"normal","lineHeight":1.16,"underline":true,"overline":false,"linethrough":false,"textAlign":"left","textBackgroundColor":"","charSpacing":0,"minWidth":20,"splitByGrapheme":false,"selectable":false,"perPixelTargetFind":false,"centeredRotation":true,"id":"0binuM0-1775820180069","groupable":false,"objectCaching":true,"styles":{}}],"perPixelTargetFind":false,"centeredRotation":false}



let result = fabricToQuillDelta(fabricData)
console.log(JSON.stringify(result, null, 2));
// console.log(result)