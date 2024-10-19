package cmd

import (
	"fmt"
	"log"
	"time"

	"github.com/jmoiron/sqlx"
	_ "github.com/lib/pq"
	"github.com/spf13/cobra"
)

var (
	artalkCmd = &cobra.Command{
		Use:   "artalk",
		Short: "A tool for merging the duplicated users",
		Run: func(cmd *cobra.Command, args []string) {
			mergeUsers()
		},
	}

	host     = ""
	port     = 0
	database = ""
	username = ""
	password = ""
)

func init() {
	artalkCmd.Flags().StringVarP(&host, "host", "", "", "The database host")
	artalkCmd.Flags().IntVarP(&port, "port", "", 0, "The database port")
	artalkCmd.Flags().StringVarP(&database, "database", "", "", "The database name")
	artalkCmd.Flags().StringVarP(&username, "username", "", "", "The database username")
	artalkCmd.Flags().StringVarP(&password, "password", "", "", "The database password")

	_ = artalkCmd.MarkFlagRequired("host")
	_ = artalkCmd.MarkFlagRequired("port")
	_ = artalkCmd.MarkFlagRequired("database")
	_ = artalkCmd.MarkFlagRequired("username")
	_ = artalkCmd.MarkFlagRequired("password")

	rootCmd.AddCommand(artalkCmd)
}

type UserStatistic struct {
	Email  string `db:"email"`
	Counts int32  `db:"counts"`
}

type User struct {
	ID        int64     `db:"id"`
	Email     string    `db:"email"`
	Name      string    `db:"name"`
	Link      string    `db:"link"`
	UpdatedAt time.Time `db:"updated_at"`
}

func mergeUsers() {
	log.Println("Try to connect to the database.")
	connStr := fmt.Sprintf("postgres://%s:%s@%s:%d/%s?sslmode=disable", username, password, host, port, database)
	db, err := sqlx.Connect("postgres", connStr)
	if err != nil {
		log.Fatal(err)
	}
	if err = db.Ping(); err != nil {
		log.Fatal(err)
	}

	log.Println("Try to query the duplicated users.")
	var duplicatedUsers []UserStatistic
	err = db.Select(&duplicatedUsers, "SELECT email, count(email) AS counts FROM atk_users GROUP BY email HAVING count(email) > 1 ORDER BY count(email) DESC;")
	if err != nil {
		log.Fatal(err)
	}

	if len(duplicatedUsers) > 0 {
		log.Printf("Find %d duplicated users.", len(duplicatedUsers))
	} else {
		log.Println("No duplicated users find, exit.")
	}

	for _, user := range duplicatedUsers {
		deleteDuplicateUsers(db, user)
	}
}

func deleteDuplicateUsers(db *sqlx.DB, user UserStatistic) {
	var users []User
	err := db.Select(&users, "SELECT id, email, name, link, updated_at FROM atk_users WHERE email = $1", user.Email)
	if err != nil {
		log.Fatal(err)
	}
	if len(users) <= 1 {
		fmt.Println("No duplicated users find.")
		return
	}

	fmt.Println("Start to remove duplicated user", user.Email)
	for i, u := range users {
		fmt.Println("Index", i)
		fmt.Printf("name: %s link: %s update: %s\n\n", u.Name, u.Link, u.UpdatedAt)
	}

	fmt.Println("Input the index to choose the user to keep, other users will be merged into the selected user.")
	var index = -1
	_, _ = fmt.Scanln(&index)
	for index < 0 || index >= len(users) {
		fmt.Printf("Invalid index number. It should in range [0, %d)\n", len(users))
		_, _ = fmt.Scanln(&index)
	}

	keptID := users[index].ID
	for i, u := range users {
		if i == index {
			continue
		}

		// Delete the user.
		db.MustExec("UPDATE atk_comments SET user_id = $1 WHERE user_id = $2", keptID, u.ID)
		db.MustExec("DELETE FROM atk_users WHERE id = $1", u.ID)
	}
}
