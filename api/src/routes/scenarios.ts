import { Router } from 'express';
import { z } from 'zod';
import { eq, desc, and } from 'drizzle-orm';
import { db } from '../db/index.js';
import { trainerScenarios } from '../db/schema/trainer.js';
import type { AuthenticatedRequest } from '../middleware/auth.js';

const router = Router();

router.get('/', async (req: AuthenticatedRequest, res) => {
	const scenarios = await db.select().from(trainerScenarios)
		.where(eq(trainerScenarios.createdBy, req.userId!))
		.orderBy(desc(trainerScenarios.updatedAt));
	res.json(scenarios);
});

const upsertSchema = z.object({
	title: z.string().min(1),
	description: z.string().optional(),
	constructionType: z.string().optional(),
	address: z.string().optional(),
	occupancyType: z.string().optional(),
	alarmLevel: z.string().optional(),
	sideAlphaImageUrl: z.string().optional(),
	sideBravoImageUrl: z.string().optional(),
	sideCharlieImageUrl: z.string().optional(),
	sideDeltaImageUrl: z.string().optional(),
	stageMetadataJson: z.record(z.unknown()).optional(),
	defaultResources: z.array(z.object({ unitName: z.string(), status: z.string() })).optional()
});

router.post('/', async (req: AuthenticatedRequest, res) => {
	const parsed = upsertSchema.safeParse(req.body);
	if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }

	const id = crypto.randomUUID();
	await db.insert(trainerScenarios).values({
		id, createdBy: req.userId!, ...parsed.data,
		stageMetadataJson: parsed.data.stageMetadataJson ?? {},
		defaultResources: parsed.data.defaultResources ?? []
	});
	res.json({ id });
});

router.put('/:id', async (req: AuthenticatedRequest, res) => {
	const parsed = upsertSchema.partial().safeParse(req.body);
	if (!parsed.success) { res.status(400).json({ error: parsed.error }); return; }
	const id = String(req.params.id);
	const result = await db.update(trainerScenarios).set(parsed.data)
		.where(and(eq(trainerScenarios.id, id), eq(trainerScenarios.createdBy, req.userId!)));
	if (result.rowCount === 0) { res.status(404).json({ error: 'Scenario not found' }); return; }
	res.json({ success: true });
});

router.delete('/:id', async (req: AuthenticatedRequest, res) => {
	const id = String(req.params.id);
	const result = await db.delete(trainerScenarios)
		.where(and(eq(trainerScenarios.id, id), eq(trainerScenarios.createdBy, req.userId!)));
	if (result.rowCount === 0) { res.status(404).json({ error: 'Scenario not found' }); return; }
	res.json({ success: true });
});

export default router;
