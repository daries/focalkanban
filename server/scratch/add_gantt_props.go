package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

type Property struct {
	ID      string        `json:"id"`
	Name    string        `json:"name"`
	Type    string        `json:"type"`
	Options []interface{} `json:"options"`
}

func main() {
	dbPath := "/Users/darie/Project/PM/focalboard/focalboard.db"
	db, err := sql.Open("sqlite3", dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()

	boardIDs := []string{"bb8g4frjc6jg9tmrfc83dzksgee", "b4kanacrrfjgitgftno5xrqrgfe"}
	for _, boardID := range boardIDs {
		var cardPropsJSON string
		err = db.QueryRow("SELECT card_properties FROM boards WHERE id = ?", boardID).Scan(&cardPropsJSON)
		if err != nil {
			fmt.Printf("Error fetching board %s: %v\n", boardID, err)
			continue
		}

		var props []Property
		json.Unmarshal([]byte(cardPropsJSON), &props)

		// Add Mulai Pekerjaan
		hasMulai := false
		for _, p := range props {
			if p.Name == "Mulai Pekerjaan" {
				hasMulai = true
				break
			}
		}
		if !hasMulai {
			props = append(props, Property{
				ID:      "prop_mulai_" + boardID[:8],
				Name:    "Mulai Pekerjaan",
				Type:    "date",
				Options: []interface{}{},
			})
		}

		// Add Selesai Pekerjaan
		hasSelesai := false
		for _, p := range props {
			if p.Name == "Selesai Pekerjaan" {
				hasSelesai = true
				break
			}
		}
		if !hasSelesai {
			props = append(props, Property{
				ID:      "prop_selesai_" + boardID[:8],
				Name:    "Selesai Pekerjaan",
				Type:    "date",
				Options: []interface{}{},
			})
		}

		newPropsJSON, _ := json.Marshal(props)
		_, err = db.Exec("UPDATE boards SET card_properties = ? WHERE id = ?", string(newPropsJSON), boardID)
		if err != nil {
			log.Fatal(err)
		}

		fmt.Println("Successfully updated board properties for board:", boardID)
	}
}
