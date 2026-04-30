import { Injectable, Inject, InternalServerErrorException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';

@Injectable()
export class AgronomyService {
  constructor(@Inject(DATABASE_POOL) private pool: Pool) {}

  async uploadDocument(
    paddockId: string,
    documentType: string,
    fileUrl: string,
    fileName: string,
    userId: string
  ) {
    try {
      const result = await this.pool.query(
        `INSERT INTO agronomy_documents 
         (paddock_id, document_type, file_url, file_name, uploaded_by) 
         VALUES ($1, $2, $3, $4, $5) 
         RETURNING *`,
        [paddockId, documentType, fileUrl, fileName, userId]
      );
      return result.rows[0];
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to upload document record');
    }
  }

  async getDocumentsForPaddock(paddockId: string) {
    try {
      const result = await this.pool.query(
        `SELECT d.*, u.name as uploaded_by_name 
         FROM agronomy_documents d
         LEFT JOIN users u ON d.uploaded_by = u.id
         WHERE d.paddock_id = $1 
         ORDER BY d.created_at DESC`,
        [paddockId]
      );
      return result.rows;
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to fetch documents');
    }
  }

  async deleteDocument(id: string) {
    try {
      await this.pool.query(
        `DELETE FROM agronomy_documents WHERE id = $1`,
        [id]
      );
      return { success: true };
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to delete document');
    }
  }
}
