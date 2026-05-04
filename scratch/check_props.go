package main

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"log"

	_ "github.com/mattn/go-sqlite3"
)

type Board struct {
	ID    string `json:"id"`
	Title string `json:"title"`
	Fields string `json:"fields"`
}

type BoardFields struct {
	CardProperties []interface{} `json:"cardProperties"`
}

func main() {
	db, err := sql.Open("sqlite3", "/Users/darie/Project/PM/focalboard/focalboard.db")
	if (err != nil) {
		log.Fatal(err)
	}
	defer db.Close()

	rows, err := db.Query("SELECT id, title, fields FROM boards")
	if (err != nil) {
		log.Fatal(err)
	}
	defer rows.Close()

	for rows.Next() {
		var b Board
		if err := rows.Scan(&b.ID, &b.Title, &b.Fields); err != nil {
			log.Fatal(err)
		}
		fmt.Printf("Board: %s (%s)\n", b.Title, b.ID)
		
		var fields map[string]interface{}
		json.Unmarshal([]byte(b.Fields), &fields)
		
		props, _ := json.MarshalIndent(fields["cardProperties"], "", "  ")
		fmt.Println("Properties:", string(props))
		fmt.Println("--------------------------------")
	}
}
