package auth

// Copyright (C) 2023 by Posit Software, PBC.

import (
	"crypto"
	"crypto/hmac"
	"crypto/md5"
	"crypto/rand"
	"crypto/rsa"
	"crypto/sha1"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"net/http"
	"strings"
	"time"

	"github.com/rstudio/connect-client/internal/util"
)

type tokenAuthenticator struct {
	token      string
	secret     string
	privateKey string
}

// NewTokenAuthenticator creates an AuthMethod that will sign
// requests using the provided secret (for Cloud and shinyapps.io)
// or private key (for Connect).
func NewTokenAuthenticator(token, secret, privateKey string) AuthMethod {
	// Allow an alternative header name.
	// Connect also accepts "X-Rsc-Authorization".
	return &tokenAuthenticator{
		token:      token,
		secret:     secret,
		privateKey: privateKey,
	}
}

var errMissingToken = errors.New("Token authentication requires a token")
var errMissingKeyOrSecret = errors.New("Token authentication requires secret or private key")

func (a *tokenAuthenticator) AddAuthHeaders(req *http.Request) error {
	if a.token == "" {
		return errMissingToken
	}
	if a.secret == "" && a.privateKey == "" {
		return errMissingKeyOrSecret
	}
	err := a.signRequest(req, time.Now())
	if err != nil {
		return err
	}
	return nil
}

func MD5(data []byte) []byte {
	hash := md5.Sum([]byte(data))
	return hash[:]
}

func SHA1(data []byte) []byte {
	hash := sha1.Sum([]byte(data))
	return hash[:]
}

func (a *tokenAuthenticator) signRequest(req *http.Request, now time.Time) error {
	// This is modeled after the implementation in
	// https://github.com/rstudio/rsconnect/blob/main/R/http.R
	date := now.UTC().Format(http.TimeFormat)
	body, err := util.GetRequestBody(req)
	if err != nil {
		return err
	}

	var bodyMD5 string
	var signature string

	if a.secret != "" {
		// Secret (Posit Cloud, shinyapps.io)
		bodyMD5 = hex.EncodeToString(MD5(body))
		canonicalRequest := strings.Join([]string{req.Method, req.URL.Path, date, bodyMD5}, "\n")
		decodedSecret, err := base64.StdEncoding.DecodeString(a.secret)
		if err != nil {
			return err
		}
		hash := hmac.New(sha256.New, decodedSecret)
		requestHMAC := hash.Sum([]byte(canonicalRequest))
		signature = base64.StdEncoding.EncodeToString(requestHMAC) + "; version=1"
	} else {
		// Private key (Posit Connect)
		bodyMD5 = base64.StdEncoding.EncodeToString(MD5(body))
		decodedKey, err := base64.StdEncoding.DecodeString(a.privateKey)
		if err != nil {
			return err
		}
		key, err := x509.ParsePKCS1PrivateKey(decodedKey)
		if err != nil {
			return err
		}
		canonicalRequest := strings.Join([]string{req.Method, req.URL.Path, date, bodyMD5}, "\n")
		requestSHA := SHA1([]byte(canonicalRequest))
		rsaSignature, err := rsa.SignPKCS1v15(rand.Reader, key, crypto.SHA1, requestSHA)
		if err != nil {
			return err
		}
		signature = base64.StdEncoding.EncodeToString(rsaSignature)
	}

	req.Header.Set("Date", date)
	req.Header.Set("X-Auth-Token", a.token)
	req.Header.Set("X-Auth-Signature", signature)
	req.Header.Set("X-Content-Checksum", bodyMD5)
	return nil
}
