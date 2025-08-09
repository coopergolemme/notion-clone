import { FastifyInstance } from 'fastify';
import { query } from '../db.js';
import { latexToHtmlPage } from '../utils/latexHtml.js';
import puppeteer from 'puppeteer';

export function registerExportRoutes(app: FastifyInstance) {
  app.get('/export/pdf/:id', async (req, reply) => {
    const { id } = req.params as { id: string };
    const row = await query<{ title: string; content: string; format: string }>(
      'select title, content, format from page where id=$1',
      [id]
    );
    if (!row.rows.length) return reply.code(404).send({ error: 'not found' });
    const { title, content, format } = row.rows[0];

    const html = latexToHtmlPage(title, content);

    const browser = await puppeteer.launch({
      // Helps on some Linux/macOS dev setups
      args: ['--no-sandbox', '--disable-setuid-sandbox'],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: 'networkidle0' });
    const pdf = await page.pdf({
      format: 'A4',
      printBackground: true,
      margin: { top: '16mm', bottom: '16mm', left: '16mm', right: '16mm' },
    });
    await browser.close();

    reply
      .header('Content-Type', 'application/pdf')
      .header('Content-Disposition', `attachment; filename="${(title || 'document').replace(/\W+/g, '_')}.pdf"`)
      .send(pdf);
  });
}
