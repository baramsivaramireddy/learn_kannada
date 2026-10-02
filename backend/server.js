const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { randomUUID } = require('crypto');
const { S3Client, PutObjectCommand, HeadObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');

dotenv.config();

if (!process.env.DATABASE_URL && process.env.db_username && process.env.db_password) {
  const databaseHost = process.env.DB_HOST || 'db.learnkannada.co.in';
  const databasePort = process.env.DB_PORT || '5432';
  const databaseName = process.env.DB_NAME || 'learnkannada';
  const username = encodeURIComponent(process.env.db_username);
  const password = encodeURIComponent(process.env.db_password);
  process.env.DATABASE_URL = `postgresql://${username}:${password}@${databaseHost}:${databasePort}/${databaseName}`;
}

const { PrismaClient } = require('@prisma/client');
const { evaluateQuizItems } = require('./services/content-service/core');

const app = express();
const port = process.env.PORT || 4000;
const prisma = new PrismaClient();

app.use(cors());
app.use(express.json());

app.get('/health', (_req, res) => {
  res.json({
    status: 'ok',
    service: 'learn-kannada-api',
  });
});

app.get('/db-health', async (_req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({
      status: 'ok',
      service: 'learn-kannada-database',
    });
  } catch (error) {
    console.error('Database health check failed:', error.message);
    res.status(503).json({
      status: 'error',
      service: 'learn-kannada-database',
      message: 'Database connection failed',
    });
  }
});

const assetInclude = true;
const learningItemInclude = {
  where: { visibility: 'PUBLIC' },
  orderBy: { sequence: 'asc' },
  include: { image: assetInclude, audio: assetInclude },
};
const quizItemInclude = {
  where: { visibility: 'PUBLIC' },
  orderBy: { sequence: 'asc' },
  include: {
    questionAsset: assetInclude,
    options: { orderBy: { sequence: 'asc' }, include: { asset: assetInclude } },
  },
};
const subsectionInclude = {
  image: assetInclude,
  learningItems: learningItemInclude,
  quizItems: quizItemInclude,
};
const sectionInclude = {
  image: assetInclude,
  subsections: {
    where: { visibility: 'PUBLIC' },
    orderBy: { sequence: 'asc' },
    include: subsectionInclude,
  },
};

function learnerAsset(asset) {
  if (!asset || asset.visibility !== 'PUBLIC') return null;
  const { visibility, ...publicAsset } = asset;
  return publicAsset;
}

function learnerOption(option) {
  const { isCorrect, asset, ...publicOption } = option;
  return { ...publicOption, asset: learnerAsset(asset) };
}

function learnerQuizItem(item) {
  const { questionAsset, options, visibility, ...publicItem } = item;
  return {
    ...publicItem,
    question: {
      type: item.questionType,
      ...(item.questionText ? { text: item.questionText } : {}),
      ...(item.questionAssetId ? { asset: learnerAsset(questionAsset) } : {}),
    },
    options: options.map(learnerOption),
  };
}

function learnerLearningItem(item) {
  return {
    ...item,
    image: learnerAsset(item.image),
    audio: learnerAsset(item.audio),
  };
}

function learnerSubsection(subsection) {
  const { visibility, image, learningItems, quizItems, ...publicSubsection } = subsection;
  return {
    ...publicSubsection,
    image: learnerAsset(image),
    learningItems: learningItems.map(learnerLearningItem),
    quizItems: quizItems.map(learnerQuizItem),
  };
}

function learnerSection(section) {
  const { visibility, image, subsections, ...publicSection } = section;
  return {
    ...publicSection,
    image: learnerAsset(image),
    subsections: subsections.map(learnerSubsection),
  };
}

app.get('/catalog/sections', async (_req, res, next) => {
  try {
    const sections = await prisma.section.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: { sequence: 'asc' },
      include: sectionInclude,
    });
    res.json({ sections: sections.map(learnerSection) });
  } catch (error) {
    next(error);
  }
});

app.get('/catalog/content', async (_req, res, next) => {
  try {
    const sections = await prisma.section.findMany({
      where: { visibility: 'PUBLIC' },
      orderBy: { sequence: 'asc' },
      include: sectionInclude,
    });
    res.json({ sections: sections.map(learnerSection) });
  } catch (error) {
    next(error);
  }
});

app.get('/catalog/sections/:sectionId', async (req, res, next) => {
  try {
    const section = await prisma.section.findFirst({
      where: { id: req.params.sectionId, visibility: 'PUBLIC' },
      include: sectionInclude,
    });
    if (!section) return res.status(404).json({ message: 'Section not found' });
    res.json({ section: learnerSection(section) });
  } catch (error) {
    next(error);
  }
});

app.get('/catalog/subsections/:subsectionId', async (req, res, next) => {
  try {
    const subsection = await prisma.subsection.findFirst({
      where: {
        id: req.params.subsectionId,
        visibility: 'PUBLIC',
        section: { visibility: 'PUBLIC' },
      },
      include: subsectionInclude,
    });
    if (!subsection) return res.status(404).json({ message: 'Subsection not found' });
    res.json({ subsection: learnerSubsection(subsection) });
  } catch (error) {
    next(error);
  }
});

app.post('/quiz-items/:quizItemId/check', async (req, res, next) => {
  try {
    const quizItem = await prisma.quizItem.findFirst({
      where: {
        id: req.params.quizItemId,
        visibility: 'PUBLIC',
        subsection: { visibility: 'PUBLIC', section: { visibility: 'PUBLIC' } },
      },
      include: { options: { orderBy: { sequence: 'asc' } } },
    });
    if (!quizItem) return res.status(404).json({ message: 'Quiz question not found' });
    if (!Array.isArray(req.body.selectedOptionIds)) throw httpError(400, 'selectedOptionIds must be an array');
    const result = evaluateQuizItems(quizItem.subsectionId, [quizItem], [
      { quizItemId: quizItem.id, selectedOptionIds: req.body.selectedOptionIds },
    ]);
    res.json({ result: result.itemResults[0] });
  } catch (error) {
    next(error);
  }
});

function httpError(status, message) {
  return Object.assign(new Error(message), { status });
}

function requiredString(value, field) {
  if (typeof value !== 'string' || !value.trim()) throw httpError(400, `${field} is required`);
  return value.trim();
}

function requiredSequence(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw httpError(400, 'sequence must be a finite number');
  return value;
}

function parseVisibility(value, fallback = 'DRAFT') {
  const visibility = value === undefined ? fallback : value;
  if (visibility !== 'DRAFT' && visibility !== 'PUBLIC') throw httpError(400, 'visibility must be DRAFT or PUBLIC');
  return visibility;
}

function adminOnly(req, res, next) {
  const token = process.env.CONTENT_ADMIN_TOKEN;
  if (!token) return res.status(503).json({ message: 'Content authoring is not configured' });
  if (req.get('authorization') !== `Bearer ${token}`) return res.status(401).json({ message: 'Unauthorized' });
  next();
}

app.use('/admin', adminOnly);

app.get('/admin/catalog', async (_req, res, next) => {
  try {
    const [sections, assets] = await Promise.all([
      prisma.section.findMany({
        orderBy: { sequence: 'asc' },
        include: {
          image: true,
          subsections: {
            orderBy: { sequence: 'asc' },
            include: {
              image: true,
              learningItems: {
                orderBy: { sequence: 'asc' },
                include: { image: true, audio: true },
              },
              quizItems: {
                orderBy: { sequence: 'asc' },
                include: {
                  questionAsset: true,
                  options: { orderBy: { sequence: 'asc' }, include: { asset: true } },
                },
              },
            },
          },
        },
      }),
      prisma.asset.findMany({ orderBy: { createdAt: 'desc' } }),
    ]);
    res.json({ sections, assets });
  } catch (error) {
    next(error);
  }
});

async function assertAsset(assetId, expectedType, requirePublic = false) {
  if (!assetId) return null;
  const asset = await prisma.asset.findUnique({ where: { id: assetId } });
  if (!asset) throw httpError(400, 'Referenced asset was not found');
  if (expectedType && asset.type !== expectedType) throw httpError(400, `Referenced asset must be ${expectedType}`);
  if (requirePublic && asset.visibility !== 'PUBLIC') throw httpError(400, 'Publish referenced assets before publishing this content');
  return asset;
}

function readOptionalString(body, field, current = null) {
  if (!Object.hasOwn(body, field)) return current;
  if (body[field] === null && field !== 'title') return null;
  return requiredString(body[field], field);
}

function readTextContent(content, label) {
  if (!content || !['TEXT', 'IMAGE', 'AUDIO'].includes(content.type)) throw httpError(400, `${label} type must be TEXT, IMAGE, or AUDIO`);
  if (content.type === 'TEXT') return { type: 'TEXT', text: requiredString(content.text, `${label}.text`), assetId: null };
  const assetId = requiredString(content.assetId, `${label}.assetId`);
  return { type: content.type, text: null, assetId };
}

async function validateContentAsset(content, requirePublic) {
  if (content.assetId) await assertAsset(content.assetId, content.type, requirePublic);
}

app.post('/admin/assets/upload-url', async (req, res, next) => {
  try {
    const bucket = process.env.S3_BUCKET;
    const region = process.env.AWS_REGION || 'ap-south-2';
    if (!bucket) throw httpError(503, 'S3_BUCKET is not configured');
    let assetBaseUrl;
    try {
      assetBaseUrl = new URL(process.env.ASSET_BASE_URL || '');
    } catch {
      throw httpError(503, 'Set ASSET_BASE_URL to the CloudFront HTTPS domain before uploading assets');
    }
    if (assetBaseUrl.protocol !== 'https:' || assetBaseUrl.hostname.includes('.s3.') || assetBaseUrl.hostname.startsWith('s3.')) {
      throw httpError(503, 'ASSET_BASE_URL must be an HTTPS CDN hostname, not an S3 origin URL');
    }
    const fileName = requiredString(req.body.fileName, 'fileName').split(/[\\/]/).pop().replace(/[^a-zA-Z0-9._-]/g, '-');
    const contentType = requiredString(req.body.contentType, 'contentType').toLowerCase();
    const type = contentType.startsWith('image/') ? 'IMAGE' : contentType.startsWith('audio/') ? 'AUDIO' : contentType.startsWith('video/') ? 'VIDEO' : null;
    if (!type) throw httpError(400, 'Only image, audio, and video files are supported');
    if (req.body.type && req.body.type !== type) throw httpError(400, 'Asset type does not match contentType');
    const title = requiredString(req.body.title, 'title');
    const key = `assets/${randomUUID()}-${fileName}`;
    const client = new S3Client({ region });
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType }), { expiresIn: 900 });
    const url = `${assetBaseUrl.toString().replace(/\/$/, '')}/${key}`;
    const asset = await prisma.asset.create({
      data: {
        title,
        description: typeof req.body.description === 'string' ? req.body.description : null,
        type,
        url,
        location: key,
        metadata: { contentType, fileName },
        visibility: 'DRAFT',
      },
    });
    res.status(201).json({ asset, uploadUrl, requiredHeaders: { 'Content-Type': contentType } });
  } catch (error) {
    next(error);
  }
});

app.post('/admin/sections', async (req, res, next) => {
  try {
    const title = requiredString(req.body.title, 'title');
    const sequence = requiredSequence(req.body.sequence);
    const visibility = parseVisibility(req.body.visibility);
    const imageAssetId = req.body.imageAssetId || null;
    await assertAsset(imageAssetId, 'IMAGE', visibility === 'PUBLIC');
    const section = await prisma.section.create({
      data: { title, description: req.body.description || '', sequence, imageAssetId, visibility },
    });
    res.status(201).json({ section });
  } catch (error) {
    next(error);
  }
});

app.patch('/admin/sections/:id', async (req, res, next) => {
  try {
    const current = await prisma.section.findUniqueOrThrow({ where: { id: req.params.id } });
    const data = {};
    if (Object.hasOwn(req.body, 'title')) data.title = requiredString(req.body.title, 'title');
    if (Object.hasOwn(req.body, 'description')) data.description = String(req.body.description);
    if (Object.hasOwn(req.body, 'sequence')) data.sequence = requiredSequence(req.body.sequence);
    if (Object.hasOwn(req.body, 'visibility')) data.visibility = parseVisibility(req.body.visibility);
    if (Object.hasOwn(req.body, 'imageAssetId')) data.imageAssetId = req.body.imageAssetId || null;
    await assertAsset(data.imageAssetId ?? current.imageAssetId, 'IMAGE', (data.visibility || current.visibility) === 'PUBLIC');
    res.json({ section: await prisma.section.update({ where: { id: current.id }, data }) });
  } catch (error) {
    next(error);
  }
});

app.delete('/admin/sections/:id', async (req, res, next) => {
  try {
    await prisma.section.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

app.post('/admin/subsections', async (req, res, next) => {
  try {
    const sectionId = requiredString(req.body.sectionId, 'sectionId');
    const title = requiredString(req.body.title, 'title');
    const sequence = requiredSequence(req.body.sequence);
    const visibility = parseVisibility(req.body.visibility);
    if (visibility === 'PUBLIC') throw httpError(400, 'Create subsections as DRAFT and publish them after adding learning items and quiz questions');
    const imageAssetId = req.body.imageAssetId || null;
    await assertAsset(imageAssetId, 'IMAGE', visibility === 'PUBLIC');
    const subsection = await prisma.subsection.create({
      data: { sectionId, title, description: req.body.description || '', sequence, imageAssetId, visibility },
    });
    res.status(201).json({ subsection });
  } catch (error) {
    next(error);
  }
});

app.patch('/admin/subsections/:id', async (req, res, next) => {
  try {
    const current = await prisma.subsection.findUniqueOrThrow({ where: { id: req.params.id } });
    const data = {};
    if (Object.hasOwn(req.body, 'sectionId')) data.sectionId = requiredString(req.body.sectionId, 'sectionId');
    if (Object.hasOwn(req.body, 'title')) data.title = requiredString(req.body.title, 'title');
    if (Object.hasOwn(req.body, 'description')) data.description = String(req.body.description);
    if (Object.hasOwn(req.body, 'sequence')) data.sequence = requiredSequence(req.body.sequence);
    if (Object.hasOwn(req.body, 'visibility')) data.visibility = parseVisibility(req.body.visibility);
    if (Object.hasOwn(req.body, 'imageAssetId')) data.imageAssetId = req.body.imageAssetId || null;
    await assertAsset(data.imageAssetId ?? current.imageAssetId, 'IMAGE', (data.visibility || current.visibility) === 'PUBLIC');
    res.json({ subsection: await prisma.subsection.update({ where: { id: current.id }, data }) });
  } catch (error) {
    next(error);
  }
});

app.delete('/admin/subsections/:id', async (req, res, next) => {
  try {
    await prisma.subsection.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (error) {
    next(error);
  }
});

async function parseLearningItem(body, current) {
  const type = body.type || current?.type;
  if (!['WORD', 'SOUND'].includes(type)) throw httpError(400, 'type must be WORD or SOUND');
  const sequence = requiredSequence(body.sequence ?? current?.sequence);
  const subsectionId = body.subsectionId || current?.subsectionId;
  if (!subsectionId) throw httpError(400, 'subsectionId is required');
  const visibility = parseVisibility(body.visibility, current?.visibility);
  const data = { subsectionId, type, sequence, visibility, word: null, meaning: null, sound: null, description: null };
  if (type === 'WORD') {
    data.word = requiredString(body.word ?? current?.word, 'word');
    data.meaning = requiredString(body.meaning ?? current?.meaning, 'meaning');
  } else {
    data.sound = requiredString(body.sound ?? current?.sound, 'sound');
    data.description = readOptionalString(body, 'description', current?.description);
  }
  data.imageAssetId = type === 'WORD' ? (body.imageAssetId ?? current?.imageAssetId ?? null) : null;
  data.audioAssetId = body.audioAssetId ?? current?.audioAssetId ?? null;
  await assertAsset(data.imageAssetId, 'IMAGE', visibility === 'PUBLIC');
  await assertAsset(data.audioAssetId, 'AUDIO', visibility === 'PUBLIC');
  return data;
}

app.post('/admin/learning-items', async (req, res, next) => {
  try {
    const item = await prisma.learningItem.create({ data: await parseLearningItem(req.body) });
    res.status(201).json({ learningItem: item });
  } catch (error) {
    next(error);
  }
});

app.patch('/admin/learning-items/:id', async (req, res, next) => {
  try {
    const current = await prisma.learningItem.findUniqueOrThrow({ where: { id: req.params.id } });
    const item = await prisma.learningItem.update({ where: { id: current.id }, data: await parseLearningItem(req.body, current) });
    res.json({ learningItem: item });
  } catch (error) {
    next(error);
  }
});

async function parseQuizItem(body, current) {
  const type = body.type || current?.type;
  if (!['SCQ', 'MCQ', 'SOUND'].includes(type)) throw httpError(400, 'type must be SCQ, MCQ, or SOUND');
  const subsectionId = requiredString(current?.subsectionId || body.subsectionId, 'subsectionId');
  const question = readTextContent(body.question || (current ? {
    type: current.questionType,
    text: current.questionText,
    assetId: current.questionAssetId,
  } : null), 'question');
  if (type === 'SOUND' && question.type !== 'AUDIO') throw httpError(400, 'SOUND quiz questions must use AUDIO content');
  const options = body.options || (current ? await prisma.quizOption.findMany({ where: { quizItemId: current.id }, orderBy: { sequence: 'asc' } }) : null);
  if (!Array.isArray(options) || options.length < 2) throw httpError(400, 'At least two options are required');
  const optionIds = new Set();
  const parsedOptions = [];
  for (const [index, option] of options.entries()) {
    const id = option.id ? requiredString(option.id, 'option.id') : randomUUID();
    if (optionIds.has(id)) throw httpError(400, 'Option IDs must be unique');
    optionIds.add(id);
    const content = readTextContent(option, `options[${index}]`);
    await validateContentAsset(content, parseVisibility(body.visibility, current?.visibility) === 'PUBLIC');
    parsedOptions.push({ id, sequence: requiredSequence(option.sequence ?? index + 1), type: content.type, text: content.text, assetId: content.assetId, isCorrect: option.isCorrect === true });
  }
  const correctOptionIds = body.correctOptionIds || parsedOptions.filter((option) => option.isCorrect).map((option) => option.id);
  if (!Array.isArray(correctOptionIds) || correctOptionIds.some((id) => !optionIds.has(id))) throw httpError(400, 'correctOptionIds must reference available options');
  const distinctCorrectIds = new Set(correctOptionIds);
  if (distinctCorrectIds.size !== correctOptionIds.length) throw httpError(400, 'correctOptionIds must be unique');
  if (type !== 'MCQ' && distinctCorrectIds.size !== 1) throw httpError(400, `${type} requires exactly one correct option`);
  if (type === 'MCQ' && distinctCorrectIds.size < 1) throw httpError(400, 'MCQ requires at least one correct option');
  await validateContentAsset(question, parseVisibility(body.visibility, current?.visibility) === 'PUBLIC');
  return {
    subsectionId,
    type,
    sequence: requiredSequence(body.sequence ?? current?.sequence),
    visibility: parseVisibility(body.visibility, current?.visibility),
    question,
    options: parsedOptions.map((option) => ({ ...option, isCorrect: distinctCorrectIds.has(option.id) })),
  };
}

async function writeQuizItem(data, id) {
  return prisma.$transaction(async (transaction) => {
    const item = id
      ? await transaction.quizItem.update({
        where: { id },
        data: {
          type: data.type,
          sequence: data.sequence,
          visibility: data.visibility,
          questionType: data.question.type,
          questionText: data.question.text,
          questionAssetId: data.question.assetId,
        },
      })
      : await transaction.quizItem.create({
        data: {
          subsectionId: data.subsectionId,
          type: data.type,
          sequence: data.sequence,
          visibility: data.visibility,
          questionType: data.question.type,
          questionText: data.question.text,
          questionAssetId: data.question.assetId,
        },
      });
    await transaction.quizOption.deleteMany({ where: { quizItemId: item.id } });
    await transaction.quizOption.createMany({ data: data.options.map((option) => ({ ...option, quizItemId: item.id })) });
    return transaction.quizItem.findUnique({
      where: { id: item.id },
      include: { options: { orderBy: { sequence: 'asc' } } },
    });
  });
}

app.post('/admin/quiz-items', async (req, res, next) => {
  try {
    const item = await writeQuizItem(await parseQuizItem(req.body), null);
    res.status(201).json({ quizItem: item });
  } catch (error) {
    next(error);
  }
});

app.patch('/admin/quiz-items/:id', async (req, res, next) => {
  try {
    const current = await prisma.quizItem.findUniqueOrThrow({ where: { id: req.params.id } });
    const item = await writeQuizItem(await parseQuizItem(req.body, current), current.id);
    res.json({ quizItem: item });
  } catch (error) {
    next(error);
  }
});

const visibilityModels = {
  assets: prisma.asset,
  sections: prisma.section,
  subsections: prisma.subsection,
  'learning-items': prisma.learningItem,
  'quiz-items': prisma.quizItem,
};

app.patch('/admin/:resource/:id/visibility', async (req, res, next) => {
  try {
    const model = visibilityModels[req.params.resource];
    if (!model) throw httpError(404, 'Content resource not found');
    const visibility = parseVisibility(req.body.visibility);
    const current = await model.findUniqueOrThrow({ where: { id: req.params.id } });
    if (visibility === 'PUBLIC' && req.params.resource === 'assets') {
      const bucket = process.env.S3_BUCKET;
      if (!bucket) throw httpError(503, 'S3_BUCKET is not configured');
      const client = new S3Client({ region: process.env.AWS_REGION || 'ap-south-2' });
      await client.send(new HeadObjectCommand({ Bucket: bucket, Key: current.location }));
    }
    if (visibility === 'DRAFT' && req.params.resource === 'assets') {
      const [sections, subsections, learningItems, questions, options] = await Promise.all([
        prisma.section.count({ where: { imageAssetId: current.id, visibility: 'PUBLIC' } }),
        prisma.subsection.count({ where: { imageAssetId: current.id, visibility: 'PUBLIC' } }),
        prisma.learningItem.count({ where: { visibility: 'PUBLIC', OR: [{ imageAssetId: current.id }, { audioAssetId: current.id }] } }),
        prisma.quizItem.count({ where: { visibility: 'PUBLIC', questionAssetId: current.id } }),
        prisma.quizOption.count({ where: { assetId: current.id, quizItem: { visibility: 'PUBLIC' } } }),
      ]);
      if (sections + subsections + learningItems + questions + options > 0) {
        throw httpError(409, 'This asset is used by public content; hide that content before hiding the asset');
      }
    }
    if (visibility === 'PUBLIC' && req.params.resource === 'sections') {
      await assertAsset(current.imageAssetId, 'IMAGE', true);
    }
    if (visibility === 'PUBLIC' && req.params.resource === 'subsections') {
      await assertAsset(current.imageAssetId, 'IMAGE', true);
    }
    if (visibility === 'PUBLIC' && req.params.resource === 'learning-items') {
      await assertAsset(current.imageAssetId, 'IMAGE', true);
      await assertAsset(current.audioAssetId, 'AUDIO', true);
    }
    if (visibility === 'PUBLIC' && req.params.resource === 'quiz-items') {
      const [item, options] = await Promise.all([
        prisma.quizItem.findUniqueOrThrow({ where: { id: current.id } }),
        prisma.quizOption.findMany({ where: { quizItemId: current.id } }),
      ]);
      if (item.type === 'SOUND' && item.questionType !== 'AUDIO') throw httpError(400, 'SOUND quiz questions must use AUDIO content');
      if (options.length < 2 || options.filter((option) => option.isCorrect).length < 1) {
        throw httpError(400, 'A published quiz question needs at least two options and a correct answer');
      }
      if (item.type !== 'MCQ' && options.filter((option) => option.isCorrect).length !== 1) {
        throw httpError(400, `${item.type} requires exactly one correct option`);
      }
      await assertAsset(item.questionAssetId, item.questionType, true);
      for (const option of options) await assertAsset(option.assetId, option.type, true);
    }
    if (visibility === 'PUBLIC' && req.params.resource === 'subsections') {
      const [learningCount, quizItemCount] = await Promise.all([
        prisma.learningItem.count({ where: { subsectionId: current.id, visibility: 'PUBLIC' } }),
        prisma.quizItem.count({ where: { subsectionId: current.id, visibility: 'PUBLIC' } }),
      ]);
      if (learningCount < 1 || quizItemCount < 1) {
        throw httpError(400, 'Publish at least one learning item and one quiz question before publishing this subsection');
      }
    }
    const updated = await model.update({ where: { id: req.params.id }, data: { visibility } });
    res.json({ resource: req.params.resource, id: req.params.id, visibility: updated.visibility });
  } catch (error) {
    next(error);
  }
});

app.use((error, _req, res, _next) => {
  const status = Number.isInteger(error.status)
    ? error.status
    : error.code === 'P2025' ? 404
      : error.code === 'P2002' ? 409
        : 500;
  if (status === 500) console.error('Request failed:', error);
  res.status(status).json({ message: status === 500 ? 'Internal server error' : error.message });
});

const shutdown = async () => {
  await prisma.$disconnect();
  process.exit(0);
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

app.listen(port, () => {
  console.log(`API listening on port ${port}`);
});