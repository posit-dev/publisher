package deployments

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"github.com/rstudio/connect-client/internal/accounts"
	"github.com/rstudio/connect-client/internal/state"
)

type DeploymentsService interface {
	GetDeployment() *state.OldDeployment
	SetDeploymentAccount(lister accounts.AccountList, account_name string) (*state.OldDeployment, error)
}

func CreateDeploymentsService(s *state.State) DeploymentsService {
	return &deploymentsService{state: s}
}

type deploymentsService struct {
	state *state.State
}

func (s deploymentsService) GetDeployment() *state.OldDeployment {
	return state.OldDeploymentFromState(s.state)
}

func (s deploymentsService) SetDeploymentAccount(lister accounts.AccountList, name string) (*state.OldDeployment, error) {
	account, err := lister.GetAccountByName(name)
	if err != nil {
		return nil, err
	}
	s.state.Account = account
	return state.OldDeploymentFromState(s.state), nil
}
