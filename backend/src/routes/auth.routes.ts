import { Router } from 'express';
import { requestOtp, verifyOtp, verifyPhoneOtp, verifyWidgetToken } from '../controllers/auth.controller';

const router = Router();

router.post('/request-otp', requestOtp);
router.post('/verify-otp', verifyOtp);
router.post('/verify-phone-otp', verifyPhoneOtp);
router.post('/verify-widget-token', verifyWidgetToken);

export default router;
