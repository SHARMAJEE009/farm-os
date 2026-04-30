import { 
  Controller, Post, Get, Delete, Param, UseInterceptors, 
  UploadedFile, Body, Req, UseGuards 
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { AgronomyService } from './agronomy.service';
import { JwtAuthGuard } from '../../common/auth/jwt-auth.guard';

@Controller('agronomy')
@UseGuards(JwtAuthGuard)
export class AgronomyController {
  constructor(private readonly agronomyService: AgronomyService) {}

  @Post('documents/upload')
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: './uploads',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `${file.fieldname}-${uniqueSuffix}${ext}`);
      }
    })
  }))
  async uploadDocument(
    @UploadedFile() file: Express.Multer.File,
    @Body('paddock_id') paddockId: string,
    @Body('document_type') documentType: string,
    @Req() req: any
  ) {
    const fileUrl = `/uploads/${file.filename}`;
    const fileName = file.originalname;
    const userId = req.user.id;
    return this.agronomyService.uploadDocument(paddockId, documentType, fileUrl, fileName, userId);
  }

  @Get('documents/:paddockId')
  async getDocuments(@Param('paddockId') paddockId: string) {
    return this.agronomyService.getDocumentsForPaddock(paddockId);
  }

  @Delete('documents/:id')
  async deleteDocument(@Param('id') id: string) {
    return this.agronomyService.deleteDocument(id);
  }
}
