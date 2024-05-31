// Copyright (C) 2024 by Posit Software, PBC.

package commands

import (
	"encoding/json"
	"fmt"

	"github.com/posit-dev/publisher/internal/cli_types"
	"github.com/posit-dev/publisher/internal/credentials"
)

type CredentialsCommand struct {
	Create CreateCredentialCommand `kong:"cmd" help:"Create a credential"`
	Delete DeleteCredentialCommand `kong:"cmd" help:"Delete a credential"`
	Get    GetCredentialCommand    `kong:"cmd" help:"Get a credential"`
	List   ListCredentialsCommand  `kong:"cmd" help:"List credentials"`
}

type CreateCredentialCommand struct {
	Name   string `kong:"arg,required,help='Credential nickname'"`
	URL    string `kong:"arg,required,help='Server URL'"`
	ApiKey string `kong:"arg,required,help='Server API Key'"`
}

func (cmd *CreateCredentialCommand) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	cs := credentials.CredentialsService{}
	cred, err := cs.Set(cmd.Name, cmd.URL, cmd.ApiKey)
	if err != nil {
		return err
	}

	body, err := json.MarshalIndent(cred, "", "\t")
	if err != nil {
		return err
	}

	fmt.Println(string(body))
	return nil
}

type DeleteCredentialCommand struct {
	GUID string `kong:"arg,required,help='Credential identifier'"`
}

func (cmd *DeleteCredentialCommand) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	cs := credentials.CredentialsService{}
	err := cs.Delete(cmd.GUID)
	if err != nil {
		return err
	}

	fmt.Println("ok")
	return nil
}

type GetCredentialCommand struct {
	GUID string `kong:"arg,required,help='Credential identifier'"`
}

func (cmd *GetCredentialCommand) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	cs := credentials.CredentialsService{}
	cred, err := cs.Get(cmd.GUID)
	if err != nil {
		return err
	}

	body, err := json.MarshalIndent(cred, "", "\t")
	if err != nil {
		return err
	}

	fmt.Println(string(body))
	return nil
}

type ListCredentialsCommand struct {
}

func (cmd *ListCredentialsCommand) Run(args *cli_types.CommonArgs, ctx *cli_types.CLIContext) error {
	cs := credentials.CredentialsService{}
	creds, err := cs.List()
	if err != nil {
		return err
	}

	body, err := json.MarshalIndent(creds, "", "\t")
	if err != nil {
		return err
	}

	fmt.Println(string(body))
	return nil
}
