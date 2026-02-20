import { NextResponse } from 'next/server';
import { swaggerSpec } from '@/lib/swagger';

/**
 * @swagger
 * /api/docs:
 *   get:
 *     summary: Retorna a especificação OpenAPI em formato JSON
 *     description: Endpoint que fornece a documentação completa da API no formato OpenAPI 3.0
 *     tags:
 *       - Documentação
 *     responses:
 *       200:
 *         description: Especificação OpenAPI em JSON
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 */
export async function GET() {
  return NextResponse.json(swaggerSpec);
}
