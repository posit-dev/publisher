# %% [markdown]
# ---
# title: "Penguin data transformations"
# subtitle: "Exported as JSON and CSV"
# format: email
# email-attachments:
#   - "adelie-m.csv"
#   - "gentoo-f.csv"
# ---

# %% [markdown]
# ## Setup
# %%
import palmerpenguins

penguins = palmerpenguins.load_penguins()

# %% [markdown]
# ## Filtering
# %%
gentoo_f = penguins[
    (penguins["species"] == "Gentoo") &
    (penguins["sex"] == "female")
]
adelie_m = penguins[
    (penguins["species"] == "Adelie") &
    (penguins["sex"] == "male")
]

# %% [markdown]
# ## Statistics (Gentoo)
# %%
gentoo_f.describe()

# %% [markdown]
# ## Statistics (Adelie)
# %%
adelie_m.describe()


# %% [markdown]
# ## Export
# %%
gentoo_f.to_csv("gentoo-f.csv")
gentoo_f.to_json("gentoo-f.json", orient="records")
adelie_m.to_csv("adelie-m.csv")
adelie_m.to_json("adelie-m.json", orient="records")

# %% [markdown]
# # Exported data
#
# * [gentoo-f.json](gentoo-f.json)
# * [gentoo-f.csv](gentoo-f.csv)
# * [adelie-m.json](adelie-m.json)
# * [adelie-m.csv](adelie-m.csv)

# %% [markdown]
#
# ::: {.email}
# ::: {.subject}
# Penguin data files
# :::

# %%
#| echo: false
#| output: asis
print("Identified", len(gentoo_f), "female Gentoo penguins.")
print("Identified", len(adelie_m), "male Adelie penguins.")
print("")
print("CSV files are attached.")

# %% [markdown]
# :::
