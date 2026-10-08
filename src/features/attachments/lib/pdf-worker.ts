'use client';

import { pdfjs } from 'react-pdf';

// public/pdf.worker.min.mjs must match react-pdf's bundled pdfjs-dist (pdfjs.version).
pdfjs.GlobalWorkerOptions.workerSrc = `/pdf.worker.min.mjs?v=${pdfjs.version}`;