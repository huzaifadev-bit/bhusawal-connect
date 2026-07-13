import { Router } from 'express';
import { bookRide, getRides, updateRideStatus } from '../controllers/ride.controller';

const router = Router();

router.post('/', bookRide);
router.get('/', getRides);
router.put('/:rideId/status', updateRideStatus);

export default router;
