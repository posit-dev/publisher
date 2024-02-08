library(plumber)
library(plumbertableau)
library(stringi)

#* @apiTitle Text Case API

#* Convert strings to uppercase
#* @tableauArg strings:character The strings to uppercase
#* @tableauReturn character Uppercased text
#* @post /toupper
function(strings=""){
  stri_trans_toupper(strings)
}

#* Convert strings to lowercase
#* @tableauArg strings:character The strings to lowercase
#* @tableauReturn character Lowercased text
#* @post /tolower
function(strings=""){
  stri_trans_tolower(strings)
}

#* Convert strings to title case
#* @tableauArg strings:character The strings to titlecase
#* @tableauReturn character Titlecased text
#* @post /totitle
function(strings=""){
  stri_trans_totitle(strings)
}

#* @plumber
tableau_extension
