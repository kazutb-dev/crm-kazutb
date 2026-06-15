import { jsPDF } from 'jspdf';

export const escapeFilenamePart = (value) => String(value ?? 'certificate')
    .trim()
    .replace(/[<>:"/\\|?*\u0000-\u001F]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '') || 'certificate';

export const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
});

export function drawWrappedText(ctx, text, x, y, maxWidth, lineHeight, align) {
    const source = String(text ?? '');
    const words = source.split(/\s+/).filter(Boolean);

    if (words.length === 0) {
        return;
    }

    const lines = [];
    let currentLine = words[0];

    for (let i = 1; i < words.length; i += 1) {
        const test = `${currentLine} ${words[i]}`;
        if (ctx.measureText(test).width <= maxWidth) {
            currentLine = test;
        } else {
            lines.push(currentLine);
            currentLine = words[i];
        }
    }

    lines.push(currentLine);

    lines.forEach((line, index) => {
        let drawX = x;
        if (align === 'center') {
            drawX = x + (maxWidth / 2);
        }
        if (align === 'right') {
            drawX = x + maxWidth;
        }

        ctx.fillText(line, drawX, y + (index * lineHeight));
    });
}

export function createPreviewTextStyle(field, canvasWidth, canvasHeight, defaultAlign = 'center') {
    return {
        position: 'absolute',
        left: `${(Number(field?.x ?? 0) / canvasWidth) * 100}%`,
        top: `${(Number(field?.y ?? 0) / canvasHeight) * 100}%`,
        width: `${(Number(field?.w ?? 300) / canvasWidth) * 100}%`,
        minHeight: `${(Number(field?.h ?? 40) / canvasHeight) * 100}%`,
        color: field?.color ?? '#000000',
        fontSize: `clamp(8px, ${(Number(field?.font_size ?? 24) / canvasWidth) * 100}cqw, ${Math.min(Number(field?.font_size ?? 24), 24)}px)`,
        fontFamily: field?.font_family ?? 'Arial, sans-serif',
        fontWeight: field?.font_weight ?? 'normal',
        fontStyle: field?.font_style ?? 'normal',
        textAlign: field?.align ?? defaultAlign,
        lineHeight: 1.2,
        whiteSpace: 'pre-wrap',
        zIndex: 2,
    };
}

export async function renderCertificateCanvas({
    backgroundUrl,
    canvasWidth,
    canvasHeight,
    layout,
    certificate,
    qrCanvas,
}) {
    const output = document.createElement('canvas');
    output.width = canvasWidth;
    output.height = canvasHeight;

    const ctx = output.getContext('2d');
    if (!ctx) {
        return null;
    }

    if (backgroundUrl) {
        const bg = await loadImage(backgroundUrl);
        ctx.drawImage(bg, 0, 0, canvasWidth, canvasHeight);
    } else {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    }

    const drawField = (field, text, defaultAlign = 'center') => {
        if (!field) return;

        const x = Number(field?.x ?? 0);
        const y = Number(field?.y ?? 0);
        const w = Number(field?.w ?? 300);
        const fontSize = Number(field?.font_size ?? 24);
        const fontFamily = field?.font_family ?? 'Arial, sans-serif';
        const fontWeight = field?.font_weight ?? 'normal';
        const fontStyle = field?.font_style ?? 'normal';
        const align = field?.align ?? defaultAlign;

        ctx.fillStyle = field?.color ?? '#000000';
        ctx.font = `${fontStyle} ${fontWeight} ${fontSize}px ${fontFamily}`;
        ctx.textAlign = align;
        ctx.textBaseline = 'top';

        drawWrappedText(
            ctx,
            text,
            x,
            y,
            w,
            Math.max(18, Number((fontSize * 1.25).toFixed(0))),
            align,
        );
    };

    drawField(layout?.fio, certificate?.recipient_full_name);

    if (qrCanvas instanceof HTMLCanvasElement) {
        const qr = layout?.qr ?? {};
        const qrSize = Number(qr?.size ?? 170);
        const qrX = Number(qr?.x ?? 95);
        const qrY = Number(qr?.y ?? 615);

        ctx.fillStyle = '#ffffff';
        ctx.fillRect(qrX - 6, qrY - 6, qrSize + 12, qrSize + 12);
        ctx.drawImage(qrCanvas, qrX, qrY, qrSize, qrSize);
    }

    return output;
}

export function downloadCanvasAsPng(canvas, filename) {
    const link = document.createElement('a');
    link.href = canvas.toDataURL('image/png');
    link.download = filename;
    link.click();
}

export function downloadCanvasAsPdf(canvas, filename) {
    const orientation = canvas.width >= canvas.height ? 'landscape' : 'portrait';
    const pdf = new jsPDF({
        orientation,
        unit: 'px',
        format: [canvas.width, canvas.height],
    });

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', 0, 0, canvas.width, canvas.height);
    pdf.save(filename);
}
