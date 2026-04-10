function mapFontSize(size) {
  if (size <= 16) return 14;
  if (size <= 21) return 18;
  if (size <= 26) return 24;
  return 32;
}


function fabricToQuillDelta(fabricJson) {
  const result = [];

  fabricJson.objects.forEach((obj, index) => {
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
      "type": "textbox",
      "version": "3.6.3",
      "originX": "left",
      "originY": "top",
      "left": 544,
      "top": 199,
      "width": 170.5,
      "height": 29.38,
      "fill": "#0111f4",
      "stroke": null,
      "strokeWidth": 1,
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
      "text": "This is blue",
      "fontSize": "26",
      "fontWeight": "bold",
      "fontFamily": "Verdana",
      "fontStyle": "normal",
      "lineHeight": 1.16,
      "underline": false,
      "overline": false,
      "linethrough": false,
      "textAlign": "left",
      "textBackgroundColor": "",
      "charSpacing": 0,
      "minWidth": 20,
      "splitByGrapheme": false,
      "selectable": true,
      "perPixelTargetFind": false,
      "centeredRotation": true,
      "id": "0binuM0-1775631746548",
      "groupable": false,
      "objectCaching": true,
      "styles": {}
    },
    {
      "type": "textbox",
      "version": "3.6.3",
      "originX": "left",
      "originY": "top",
      "left": 946,
      "top": 140,
      "width": 270.63,
      "height": 33.9,
      "fill": "#69655d",
      "stroke": null,
      "strokeWidth": 1,
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
      "text": "This is underlined",
      "fontSize": "30",
      "fontWeight": "normal",
      "fontFamily": "Verdana",
      "fontStyle": "normal",
      "lineHeight": 1.16,
      "underline": true,
      "overline": false,
      "linethrough": false,
      "textAlign": "left",
      "textBackgroundColor": "",
      "charSpacing": 0,
      "minWidth": 20,
      "splitByGrapheme": false,
      "selectable": true,
      "perPixelTargetFind": false,
      "centeredRotation": true,
      "id": "0binuM0-1775631772752",
      "groupable": false,
      "objectCaching": true,
      "styles": {}
    }
  ],
  "perPixelTargetFind": false,
  "centeredRotation": false
}


let result = fabricToQuillDelta(fabricData)
console.log(JSON.stringify(result, null, 2));
// console.log(result)