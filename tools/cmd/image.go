package cmd

import (
	"fmt"
	"log"
	"os"
	"path/filepath"
	"regexp"
	"time"

	"github.com/disintegration/imaging"
	"github.com/spf13/cobra"
)

// imageCmd represents the image command
var (
	imageCmd = &cobra.Command{
		Use:   "image",
		Short: "A tool for processing images to my desired format, size and naming",
		Run: func(cmd *cobra.Command, args []string) {
			if source == "" {
				log.Fatalf("The source should be provided")
			}
			if !localDatePattern.Match([]byte(localDate)) {
				log.Fatalf("This is an invalid local date format %s", localDate)
			}

			process()
		},
	}

	width            = 1280
	source           = ""
	output           = executablePath()
	localDate        = time.Now().Format("20060102")
	localDatePattern = regexp.MustCompile(`^\d{8}$`)
)

func init() {
	imageCmd.Flags().StringVarP(&source, "source", "", "", "The image file path (absolute of relative) that you want to process")
	imageCmd.Flags().StringVarP(&output, "output", "", output, "The output path")
	imageCmd.Flags().IntVarP(&width, "width", "", 1280, "The compressed width for the given image")
	imageCmd.Flags().StringVarP(&localDate, "local", "", localDate, "The local date time, in yyyyMMdd format")

	rootCmd.AddCommand(imageCmd)
}

func executablePath() string {
	ex, _ := os.Executable()
	return filepath.Dir(ex)
}

func process() {
	// Open a test image.
	src, err := imaging.Open(source)
	if err != nil {
		log.Fatalf("failed to open image: %v", err)
	}

	// Resize the cropped image to width = 200px preserving the aspect ratio.
	src = imaging.Resize(src, width, 0, imaging.Lanczos)

	// Save the resulting image as JPEG.
	target := localDate + time.Now().Format("150405") + fmt.Sprintf("%02d", time.Now().Nanosecond()%100) + ".jpg"

	err = imaging.Save(src, filepath.Join(output, target))
	if err != nil {
		log.Fatalf("failed to save image: %v", err)
	}
}
