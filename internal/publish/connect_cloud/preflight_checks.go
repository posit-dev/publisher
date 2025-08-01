package connect_cloud

// Copyright (C) 2025 by Posit Software, PBC.

//type checkConfigurationStartData struct{}
//type checkConfigurationSuccessData struct{}

// PreFlightChecks is a no-op for Connect Cloud as requested.
// It emits start and success events but doesn't actually perform any checks.
func (c *ServerPublisher) PreFlightChecks() error {
	//op := events.PublishCheckCapabilitiesOp
	//log := c.log.WithArgs(logging.LogKeyOp, op)
	//
	//c.emitter.Emit(events.New(op, events.StartPhase, events.NoError, checkConfigurationStartData{}))
	//log.Info("Connect Cloud: No preflight checks needed")
	//
	//// No actual checks performed as per requirements
	//
	//log.Info("Configuration OK")
	//c.emitter.Emit(events.New(op, events.SuccessPhase, events.NoError, checkConfigurationSuccessData{}))
	return nil
}
