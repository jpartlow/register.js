require 'erb'

namespace :erb do
  desc "Regenerate test/*.html from html/*.html.erb"
  task :generate do
    Dir.glob('html/*.html.erb').each do |filename|
      file = File.open(filename)
      template = ERB.new(file.read())
      result = template.result
      filename.match(/\/([-_\w\d]+.html).erb/)
      output_filename = "test/#{$1}"
      output_file = File.open(output_filename, "w")
      output_file << result
      output_file.close()
    end    
  end
end
