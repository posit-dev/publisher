package state

import (
	"github.com/stretchr/testify/mock"
)

type MockSerializer struct {
	mock.Mock
}

func NewMockSerializer() *MockSerializer {
	return &MockSerializer{}
}

func (m *MockSerializer) Save(label MetadataLabel, src any) error {
	args := m.Called(label, src)
	return args.Error(0)
}

func (m *MockSerializer) Load(label MetadataLabel, dest any) error {
	args := m.Called(label, dest)
	return args.Error(0)
}
