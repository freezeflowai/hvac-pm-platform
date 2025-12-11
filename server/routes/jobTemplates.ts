import { Router } from 'express';
import { storage } from '../storage';
import { insertJobTemplateSchema, insertJobTemplateLineItemSchema } from '@shared/schema';
import { z } from 'zod';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { jobType, activeOnly } = req.query;
    const filter = {
      jobType: jobType as string | undefined,
      activeOnly: activeOnly === 'false' ? false : true,
    };

    const templates = await storage.getJobTemplates(user.companyId, filter);
    return res.json(templates);
  } catch (error: any) {
    console.error('Error fetching job templates:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch job templates' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const template = await storage.getJobTemplate(user.companyId, req.params.id);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const lines = await storage.getJobTemplateLineItems(template.id);
    return res.json({ ...template, lines });
  } catch (error: any) {
    console.error('Error fetching job template:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch job template' });
  }
});

const createTemplateSchema = insertJobTemplateSchema.extend({
  lines: z.array(insertJobTemplateLineItemSchema.omit({ templateId: true })).optional().default([]),
});

router.post('/', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const parsed = createTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid data', details: parsed.error.errors });
    }

    const { lines, ...templateData } = parsed.data;
    const template = await storage.createJobTemplate(user.companyId, templateData, lines);
    
    const createdLines = await storage.getJobTemplateLineItems(template.id);
    return res.status(201).json({ ...template, lines: createdLines });
  } catch (error: any) {
    console.error('Error creating job template:', error);
    return res.status(500).json({ error: error.message || 'Failed to create job template' });
  }
});

const updateTemplateSchema = insertJobTemplateSchema.partial().extend({
  lines: z.array(insertJobTemplateLineItemSchema.omit({ templateId: true })).optional(),
});

router.patch('/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const parsed = updateTemplateSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: 'Invalid data', details: parsed.error.errors });
    }

    const { lines, ...templateData } = parsed.data;
    const template = await storage.updateJobTemplate(user.companyId, req.params.id, templateData, lines);
    
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const updatedLines = await storage.getJobTemplateLineItems(template.id);
    return res.json({ ...template, lines: updatedLines });
  } catch (error: any) {
    console.error('Error updating job template:', error);
    return res.status(500).json({ error: error.message || 'Failed to update job template' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const deleted = await storage.deleteJobTemplate(user.companyId, req.params.id);
    if (!deleted) {
      return res.status(404).json({ error: 'Template not found' });
    }

    return res.status(204).send();
  } catch (error: any) {
    console.error('Error deleting job template:', error);
    return res.status(500).json({ error: error.message || 'Failed to delete job template' });
  }
});

router.post('/:id/set-default', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { jobType } = req.body;
    if (!jobType) {
      return res.status(400).json({ error: 'jobType is required' });
    }

    const template = await storage.setJobTemplateAsDefault(user.companyId, req.params.id, jobType);
    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    return res.json(template);
  } catch (error: any) {
    console.error('Error setting default template:', error);
    return res.status(500).json({ error: error.message || 'Failed to set default template' });
  }
});

router.post('/apply-to-job', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const { jobId, templateId } = req.body;
    if (!jobId || !templateId) {
      return res.status(400).json({ error: 'jobId and templateId are required' });
    }

    const createdParts = await storage.applyJobTemplateToJob(user.companyId, jobId, templateId);
    return res.status(201).json(createdParts);
  } catch (error: any) {
    console.error('Error applying template to job:', error);
    return res.status(500).json({ error: error.message || 'Failed to apply template to job' });
  }
});

router.get('/default/:jobType', async (req, res) => {
  try {
    const user = (req as any).user;
    if (!user?.companyId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const template = await storage.getDefaultJobTemplateForJobType(user.companyId, req.params.jobType);
    if (!template) {
      return res.status(404).json({ error: 'No default template for this job type' });
    }

    const lines = await storage.getJobTemplateLineItems(template.id);
    return res.json({ ...template, lines });
  } catch (error: any) {
    console.error('Error fetching default template:', error);
    return res.status(500).json({ error: error.message || 'Failed to fetch default template' });
  }
});

export default router;
