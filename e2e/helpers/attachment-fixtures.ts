/** Minimal valid PDF buffers for react-pdf E2E (not zero-filled stubs). */

function buildMinimalPdfBuffer(pageCount: number): Buffer {
  const objs: Array<{ id: number; body: string }> = [];
  let id = 1;
  const catalogId = id++;
  const pagesId = id++;
  const fontId = id++;
  const kids: string[] = [];

  for (let pageIndex = 0; pageIndex < pageCount; pageIndex += 1) {
    const pageId = id++;
    const contentId = id++;
    kids.push(`${pageId} 0 R`);
    objs.push({
      id: pageId,
      body: `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 200 200] /Contents ${contentId} 0 R /Resources << /Font << /F1 ${fontId} 0 R >> >> >>`
    });
    const stream = `BT /F1 12 Tf 20 100 Td (Page ${pageIndex + 1}) Tj ET`;
    objs.push({
      id: contentId,
      body: `<< /Length ${stream.length} >>stream\n${stream}\nendstream`
    });
  }

  objs.push({
    id: pagesId,
    body: `<< /Type /Pages /Kids [${kids.join(' ')}] /Count ${pageCount} >>`
  });
  objs.push({
    id: fontId,
    body: '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  });
  objs.push({
    id: catalogId,
    body: `<< /Type /Catalog /Pages ${pagesId} 0 R >>`
  });
  objs.sort((a, b) => a.id - b.id);

  let pdf = '%PDF-1.4\n';
  const xref: number[] = [0];

  for (const obj of objs) {
    xref[obj.id] = pdf.length;
    pdf += `${obj.id} 0 obj ${obj.body} endobj\n`;
  }

  const xrefStart = pdf.length;
  pdf += `xref\n0 ${objs.length + 1}\n`;
  pdf += '0000000000 65535 f \n';
  for (let objIndex = 1; objIndex <= objs.length; objIndex += 1) {
    pdf += `${String(xref[objIndex]).padStart(10, '0')} 00000 n \n`;
  }
  pdf += `trailer << /Size ${objs.length + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(pdf);
}

/** 1x1 red PNG */
export function buildMinimalPngBuffer(): Buffer {
  return Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+X2ZkAAAAASUVORK5CYII=',
    'base64'
  );
}

export function buildSinglePagePdfBuffer(): Buffer {
  return buildMinimalPdfBuffer(1);
}

export function buildThreePagePdfBuffer(): Buffer {
  return buildMinimalPdfBuffer(3);
}
