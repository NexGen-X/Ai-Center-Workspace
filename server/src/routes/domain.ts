/**
 * Automated Custom Domain & SSL Provisioning API Routes — AI Agent Command Center
 */

import { Router, Request, Response, NextFunction } from 'express';
import { DomainManagerService } from '../services/domainManagerService.js';
import { CheckDomainDnsRequest, ProvisionDomainRequest } from '../../../shared/types.js';

const router = Router();

// GET /api/system/domain/info — Retrieve server public IP and configured domains
router.get('/info', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const info = await DomainManagerService.getDomainInfo(workspaceId);
    res.json(info);
  } catch (err) {
    next(err);
  }
});

// POST /api/system/domain/check-dns — Pre-flight DNS resolution test
router.post('/check-dns', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { domainName } = req.body as CheckDomainDnsRequest;
    if (!domainName || typeof domainName !== 'string') {
      return res.status(400).json({ error: { message: 'Parameter "domainName" wajib diisi.' } });
    }

    const result = await DomainManagerService.checkDomainDns(domainName);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/system/domain/provision — Configure domain and provision SSL in Caddy
router.post('/provision', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { domainName, workspaceId } = req.body as ProvisionDomainRequest;
    if (!domainName || typeof domainName !== 'string') {
      return res.status(400).json({ error: { message: 'Parameter "domainName" wajib diisi.' } });
    }

    const result = await DomainManagerService.provisionDomain(
      domainName,
      workspaceId || 'ws-default-command-center'
    );
    res.status(201).json(result);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/system/domain/:id — Remove custom domain
router.delete('/:id', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const workspaceId = (req.query.workspaceId as string) || 'ws-default-command-center';
    const result = await DomainManagerService.removeDomain(id, workspaceId);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
