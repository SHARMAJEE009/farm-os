import { Injectable, Inject, InternalServerErrorException, NotFoundException } from '@nestjs/common';
import { Pool } from 'pg';
import { DATABASE_POOL } from '../../common/database/database.module';

@Injectable()
export class AgronomyService {
  constructor(@Inject(DATABASE_POOL) private pool: Pool) {
    console.log('AgronomyService initialized');
  }

  // ── Existing agronomy_documents CRUD ─────────────────────────────────────

  async uploadDocument(
    paddockId: string,
    documentType: string,
    fileUrl: string,
    fileName: string,
    userId: string,
  ) {
    try {
      const result = await this.pool.query(
        `INSERT INTO agronomy_documents
         (paddock_id, document_type, file_url, file_name, uploaded_by)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING *`,
        [paddockId, documentType, fileUrl, fileName, userId],
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
        [paddockId],
      );
      return result.rows;
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to fetch documents');
    }
  }

  async deleteDocument(id: string) {
    try {
      await this.pool.query(`DELETE FROM agronomy_documents WHERE id = $1`, [id]);
      return { success: true };
    } catch (err) {
      console.error(err);
      throw new InternalServerErrorException('Failed to delete document');
    }
  }

  // ── Soil Reports ─────────────────────────────────────────────────────────

  async createSoilReport(
    paddockId: string,
    farmId: string,
    season: string,
    filePath: string,
    fileName: string,
    uploadedBy: string,
  ) {
    try {
      const { rows } = await this.pool.query(
        `INSERT INTO soil_reports
         (paddock_id, farm_id, uploaded_by, file_path, file_name, season, status)
         VALUES ($1, $2, $3, $4, $5, $6, 'uploaded')
         RETURNING *`,
        [paddockId, farmId, uploadedBy, filePath, fileName, season],
      );
      return rows[0];
    } catch (err) {
      console.error('Error creating soil report:', err);
      throw new InternalServerErrorException('Failed to save soil report');
    }
  }

  async getMyUploads(userId: string) {
    try {
      const { rows } = await this.pool.query(
        `SELECT sr.*,
                p.name as paddock_name,
                f.name as farm_name
         FROM soil_reports sr
         LEFT JOIN paddocks p ON sr.paddock_id = p.id
         LEFT JOIN farms f ON sr.farm_id = f.id
         WHERE sr.uploaded_by = $1
         ORDER BY sr.created_at DESC`,
        [userId],
      );
      return rows;
    } catch (err) {
      console.error('Error fetching uploads:', err);
      throw new InternalServerErrorException('Failed to fetch uploads');
    }
  }

  async getSoilReportsByFarm(farmId: string) {
    try {
      const { rows } = await this.pool.query(
        `SELECT sr.*,
                p.name as paddock_name, p.land_area, p.crop_type,
                f.name as farm_name,
                u.name as uploaded_by_name
         FROM soil_reports sr
         LEFT JOIN paddocks p ON sr.paddock_id = p.id
         LEFT JOIN farms f ON sr.farm_id = f.id
         LEFT JOIN users u ON sr.uploaded_by = u.id
         WHERE sr.farm_id = $1
         ORDER BY sr.created_at DESC`,
        [farmId],
      );
      return rows;
    } catch (err) {
      console.error('Error fetching farm soil reports:', err);
      throw new InternalServerErrorException('Failed to fetch soil reports');
    }
  }

  async getAllSoilReports() {
    try {
      const { rows } = await this.pool.query(
        `SELECT sr.*,
                p.name as paddock_name, p.land_area, p.crop_type,
                f.name as farm_name,
                u.name as uploaded_by_name
         FROM soil_reports sr
         LEFT JOIN paddocks p ON sr.paddock_id = p.id
         LEFT JOIN farms f ON sr.farm_id = f.id
         LEFT JOIN users u ON sr.uploaded_by = u.id
         ORDER BY sr.created_at DESC`,
      );
      return rows;
    } catch (err) {
      console.error('Error fetching all soil reports:', err);
      throw new InternalServerErrorException('Failed to fetch soil reports');
    }
  }

  async getSoilReportById(id: string) {
    const { rows } = await this.pool.query(
      `SELECT sr.*,
              p.name as paddock_name, p.land_area, p.crop_type,
              f.name as farm_name,
              u.name as uploaded_by_name
       FROM soil_reports sr
       LEFT JOIN paddocks p ON sr.paddock_id = p.id
       LEFT JOIN farms f ON sr.farm_id = f.id
       LEFT JOIN users u ON sr.uploaded_by = u.id
       WHERE sr.id = $1`,
      [id],
    );
    if (!rows[0]) throw new NotFoundException('Soil report not found');
    return rows[0];
  }

  async updateSoilReportStatus(id: string, status: string, aiRecommendation?: object) {
    try {
      const { rows } = await this.pool.query(
        `UPDATE soil_reports
         SET status = $1,
             ai_recommendation = COALESCE($2, ai_recommendation),
             updated_at = NOW()
         WHERE id = $3
         RETURNING *`,
        [status, aiRecommendation ? JSON.stringify(aiRecommendation) : null, id],
      );
      return rows[0];
    } catch (err) {
      console.error('Error updating soil report:', err);
      throw new InternalServerErrorException('Failed to update soil report');
    }
  }

  async deleteSoilReport(id: string) {
    try {
      const { rowCount } = await this.pool.query('DELETE FROM soil_reports WHERE id = $1', [id]);
      if (rowCount === 0) throw new NotFoundException('Soil report not found');
      return { deleted: true };
    } catch (err) {
      if (err instanceof NotFoundException) throw err;
      console.error('Error deleting soil report:', err);
      throw new InternalServerErrorException('Failed to delete soil report');
    }
  }
}
