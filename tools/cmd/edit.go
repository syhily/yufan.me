package cmd

import (
	"github.com/spf13/cobra"
)

// imageCmd represents the image command
var (
	editCmd = &cobra.Command{
		Use:   "edit",
		Short: "A tool for edit the post",
		Run: func(cmd *cobra.Command, args []string) {
			// TODO We need to add the new post support
		},
	}
)

func init() {
	rootCmd.AddCommand(editCmd)
}
